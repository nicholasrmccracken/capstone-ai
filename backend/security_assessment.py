"""
Security assessment helpers for repository- and file-level reviews.

This module queries Elasticsearch/GitHub for context, builds a structured
prompt, invokes the LLM, and normalizes the response into a predictable shape.
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from github import UnknownObjectException
from langchain_openai import ChatOpenAI

from config import GITHUB_TOKEN
from github_utils import get_file_content
from ingest_pipeline import INDEX_NAME, get_elasticsearch_client

MAX_CONTEXT_CHARS = 16000
MAX_SNIPPET_CHARS = 1200
MAX_FILE_CHARS = 6000
DEFAULT_REPO_CHUNK_LIMIT = 25
DEFAULT_FINDINGS_LIMIT = 6


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _ensure_repo_inputs(
    github_url: Optional[str], owner: Optional[str], repo: Optional[str]
) -> Tuple[str, str]:
    if github_url:
        trimmed = github_url.strip().strip("/")
        parts = trimmed.split("/")
        if len(parts) < 2:
            raise ValueError("Could not determine owner/repo from github_url.")
        owner = parts[-2]
        repo = parts[-1]
    if not owner or not repo:
        raise ValueError("Both owner and repo are required for security assessment.")
    return owner, repo


def _fetch_chunks(owner: str, repo: str, file_path: Optional[str] = None) -> List[Dict[str, Any]]:
    es = get_elasticsearch_client()
    if not es.indices.exists(index=INDEX_NAME):
        return []

    filters: List[Dict[str, Any]] = [
        {"term": {"repo_owner": owner}},
        {"term": {"repo_name": repo}},
    ]
    if file_path:
        filters.append({"term": {"file_path": file_path}})

    query: Dict[str, Any] = {
        "size": DEFAULT_REPO_CHUNK_LIMIT if not file_path else 10,
        "query": {
            "bool": {
                "filter": filters,
            }
        },
        "sort": [
            {"timestamp": {"order": "desc"}}
        ],
        "_source": {
            "includes": ["file_path", "content", "repo_owner", "repo_name", "metadata"]
        },
    }

    response = es.search(index=INDEX_NAME, body=query)
    hits = response.get("hits", {}).get("hits", [])
    return [hit.get("_source", {}) for hit in hits]


def _limit_text(value: str, limit: int) -> str:
    if len(value) <= limit:
        return value
    return value[:limit] + "\n... [truncated]"


def _collect_dependency_snippets(chunks: List[Dict[str, Any]]) -> List[str]:
    dependency_suffixes = (
        "package.json",
        "requirements.txt",
        "Pipfile",
        "pyproject.toml",
        "yarn.lock",
        "pnpm-lock.yaml",
        "Cargo.toml",
        "Gemfile",
        "Dockerfile",
    )
    snippets: List[str] = []
    for chunk in chunks:
        path = (chunk.get("file_path") or "").lower()
        if any(path.endswith(suffix) for suffix in dependency_suffixes):
            snippet = chunk.get("content") or ""
            if snippet:
                snippets.append(
                    f"Dependency file: {chunk.get('file_path')}\n{_limit_text(snippet.strip(), MAX_SNIPPET_CHARS)}"
                )
    return snippets


def _format_context(owner: str, repo: str, chunks: List[Dict[str, Any]]) -> Tuple[str, List[str]]:
    if not chunks:
        return "No indexed chunks were found for this repository.", []

    context_lines: List[str] = []
    sampled_files: List[str] = []

    for chunk in chunks:
        file_path = chunk.get("file_path") or "unknown"
        sampled_files.append(file_path)
        snippet = (chunk.get("content") or "").strip()
        if not snippet:
            continue
        context_lines.append(
            f"File: {file_path}\nSnippet:\n{_limit_text(snippet, MAX_SNIPPET_CHARS)}"
        )
        if len("".join(context_lines)) > MAX_CONTEXT_CHARS:
            break

    dependency_bits = _collect_dependency_snippets(chunks)
    if dependency_bits:
        context_lines.append("\nDependency snapshots:\n" + "\n\n".join(dependency_bits))

    combined = "\n\n---\n\n".join(context_lines)
    return _limit_text(combined, MAX_CONTEXT_CHARS), sorted(set(sampled_files))


def _build_prompt(
    scope: str,
    owner: str,
    repo: str,
    context: str,
    file_path: Optional[str] = None,
    file_content: Optional[str] = None,
    hints: Optional[List[str]] = None,
) -> str:
    hints_text = ""
    if hints:
        hints_text = "\nHeuristic signals detected:\n- " + "\n- ".join(hints)

    file_section = ""
    if scope == "file" and file_path and file_content:
        file_section = f"""
Target file: {file_path}

Full file excerpt (truncated at {MAX_FILE_CHARS} chars):
{_limit_text(file_content, MAX_FILE_CHARS)}
"""

    instructions = """
You are an experienced application security engineer reviewing GitHub code.
Analyze the provided context and return JSON with this shape:
{
  "summary": "<overall risk synopsis>",
  "findings": [
    {
      "severity": "critical|high|medium|low|info",
      "title": "<short name>",
      "description": "<what is wrong and why it matters>",
      "file_path": "<relative path if known>",
      "line_hints": "<line numbers or patterns if available>",
      "evidence": "<quote the relevant code or configuration>",
      "remediation": "<specific fix recommendation>",
      "category": "<CWE/OWASP label if possible>"
    }
  ]
}

Guidelines:
- Severity must reflect exploitability and impact.
- Keep findings list short (max 6) and prioritize unique issues.
- If no issues are evident, return an empty list with a summary that explains the coverage limits.
- NEVER include prose outside of the JSON object.
""".strip()

    prompt = f"""
Scope: {scope.upper()} security review for {owner}/{repo}
{f"Target file: {file_path}" if file_path else ""}

{instructions}
{hints_text}
{file_section}
Repository snippets and metadata:
{context}
"""
    return prompt.strip()


def _derive_hints(*texts: str) -> List[str]:
    hint_keywords = {
        "Possible credential": ["secret", "apikey", "token", "password", "aws_access"],
        "Disabled TLS verification": ["verify=False", "NODE_TLS_REJECT_UNAUTHORIZED"],
        "Command execution": ["exec(", "subprocess.Popen", "system(", "child_process.exec"],
        "Weak crypto": ["md5", "sha1", "des", "rc4"],
        "Dangerous eval": ["eval(", "Function(", "pickle.loads", "yaml.load("],
    }
    lowered = " ".join(texts).lower()
    hits: List[str] = []
    for label, needles in hint_keywords.items():
        if any(needle in lowered for needle in needles):
            hits.append(label)
    return hits


def _parse_response(raw: str) -> Dict[str, Any]:
    text = raw.strip()
    if text.startswith("```"):
        # Remove Markdown fences if present
        fence_match = re.match(r"```(?:json)?\s*(.*)```", text, re.DOTALL)
        if fence_match:
            text = fence_match.group(1).strip()

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        # Attempt to extract the first JSON object substring.
        candidate = re.search(r"\{.*\}", text, re.DOTALL)
        if not candidate:
            return {"summary": text, "findings": []}
        try:
            data = json.loads(candidate.group(0))
        except json.JSONDecodeError:
            return {"summary": text, "findings": []}

    if not isinstance(data, dict):
        return {"summary": str(data), "findings": []}

    summary = str(data.get("summary") or "").strip()
    findings_raw = data.get("findings") or []
    findings: List[Dict[str, Any]] = []

    if isinstance(findings_raw, list):
        for item in findings_raw[:DEFAULT_FINDINGS_LIMIT]:
            if not isinstance(item, dict):
                continue
            findings.append(
                {
                    "severity": (item.get("severity") or "info").lower(),
                    "title": item.get("title") or item.get("name") or "Finding",
                    "description": item.get("description") or "",
                    "file_path": item.get("file_path") or item.get("file") or "",
                    "line_hints": item.get("line_hints") or item.get("lines") or "",
                    "evidence": item.get("evidence") or "",
                    "remediation": item.get("remediation") or item.get("recommendation") or "",
                    "category": item.get("category") or item.get("cwe") or "",
                }
            )

    return {"summary": summary, "findings": findings}


def _invoke_model(prompt: str, api_key: str) -> Dict[str, Any]:
    llm = ChatOpenAI(
        model="gpt-5-nano",
        temperature=0.1,
        api_key=api_key,
    )
    response = llm.invoke(prompt)
    return _parse_response(response.content)


def run_repo_security_assessment(api_key: str, github_url: Optional[str] = None, owner: Optional[str] = None, repo: Optional[str] = None) -> Dict[str, Any]:
    owner, repo = _ensure_repo_inputs(github_url, owner, repo)
    chunks = _fetch_chunks(owner, repo)
    context, sampled_files = _format_context(owner, repo, chunks)
    hints = _derive_hints(context)
    prompt = _build_prompt("repo", owner, repo, context, hints=hints)
    parsed = _invoke_model(prompt, api_key)
    return {
        "scope": "repo",
        "owner": owner,
        "repo": repo,
        "summary": parsed.get("summary") or "Security review completed. No explicit summary returned.",
        "findings": parsed.get("findings") or [],
        "sampled_files": sampled_files,
        "ran_at": _now_iso(),
        "github_token_present": bool(GITHUB_TOKEN),
        "context_source": "elasticsearch" if chunks else "empty",
    }


def run_file_security_assessment(
    api_key: str,
    file_path: str,
    github_url: Optional[str] = None,
    owner: Optional[str] = None,
    repo: Optional[str] = None,
) -> Dict[str, Any]:
    if not file_path:
        raise ValueError("file_path is required for file-level security assessment.")

    owner, repo = _ensure_repo_inputs(github_url, owner, repo)
    try:
        file_content = get_file_content(owner, repo, file_path)
    except UnknownObjectException as exc:
        raise ValueError(f"Unable to fetch {file_path}: {exc}")

    if not file_content:
        raise ValueError("File content is empty or could not be decoded.")

    chunks = _fetch_chunks(owner, repo, file_path=file_path)
    context, sampled_files = _format_context(owner, repo, chunks)
    hints = _derive_hints(file_content, context)
    prompt = _build_prompt(
        "file",
        owner,
        repo,
        context,
        file_path=file_path,
        file_content=file_content,
        hints=hints,
    )
    parsed = _invoke_model(prompt, api_key)
    return {
        "scope": "file",
        "owner": owner,
        "repo": repo,
        "file_path": file_path,
        "summary": parsed.get("summary") or "Security review completed. No explicit summary returned.",
        "findings": parsed.get("findings") or [],
        "sampled_files": sampled_files,
        "ran_at": _now_iso(),
        "github_token_present": bool(GITHUB_TOKEN),
        "context_source": "elasticsearch" if chunks else "file_only",
    }
