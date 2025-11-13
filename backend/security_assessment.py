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
from langchain_openai import ChatOpenAI, OpenAIEmbeddings

from config import GITHUB_TOKEN
from github_utils import get_file_content
from ingest_pipeline import INDEX_NAME, get_elasticsearch_client

# Updated constants for improved retrieval
MAX_CONTEXT_CHARS = 32000  # Increased from 16000 to allow more context
MAX_SNIPPET_CHARS = 1500   # Increased from 1200
MAX_FILE_CHARS = 6000
DEFAULT_FINDINGS_LIMIT = 6

# Adaptive chunk limits based on repo size
SMALL_REPO_THRESHOLD = 50   # Files
MEDIUM_REPO_THRESHOLD = 500
SMALL_REPO_CHUNK_LIMIT = 100
MEDIUM_REPO_CHUNK_LIMIT = 75
LARGE_REPO_CHUNK_LIMIT = 50

# File-type prioritization patterns (files matching these get score boost)
HIGH_RISK_FILE_PATTERNS = [
    # Authentication/Authorization
    "auth", "login", "session", "jwt", "oauth", "token", "credential",
    # Cryptography
    "crypto", "encrypt", "decrypt", "hash", "sign", "cipher", "key",
    # Database/SQL
    "sql", "query", "db", "database", "migration", "schema",
    # Input validation
    "validator", "sanitize", "validate", "input", "parser",
    # Configuration/Secrets
    ".env", "config", "secret", "password", "api_key",
    # Network/API
    "api", "endpoint", "route", "handler", "middleware",
]

# Critical files that should always be included
CRITICAL_FILE_SUFFIXES = (
    "package.json", "requirements.txt", "Pipfile", "pyproject.toml",
    "yarn.lock", "pnpm-lock.yaml", "Cargo.toml", "Gemfile",
    ".env", ".env.example", "docker-compose.yml", "Dockerfile",
    "config.json", "config.yaml", "config.yml", "settings.py",
)

# Security-focused query templates for semantic search
SECURITY_QUERIES = [
    "authentication authorization login session management security vulnerabilities",
    "SQL injection command injection code injection input validation",
    "cryptography encryption hashing weak algorithms insecure random",
    "cross-site scripting XSS CSRF security headers sanitization",
    "secrets credentials API keys tokens hardcoded passwords",
    "insecure network communication TLS SSL certificate validation",
]

# Heuristic patterns with weights for score boosting
SECURITY_HEURISTIC_PATTERNS = {
    "auth": ["authenticate", "authorize", "login", "logout", "session", "jwt", "oauth", "bearer", "token"],
    "dangerous_functions": ["eval(", "exec(", "system(", "subprocess", "child_process", "innerHTML", "dangerouslySetInnerHTML"],
    "crypto": ["encrypt", "decrypt", "hash", "md5", "sha1", "sha256", "aes", "rsa", "hmac", "sign", "verify", "random"],
    "input_handling": ["request.", "params", "query", "body", "input", "sanitize", "validate", "escape"],
    "database": ["execute", "query", "SELECT", "INSERT", "UPDATE", "DELETE", "sql", "orm"],
    "secrets": ["password", "secret", "key", "token", "api_key", "apikey", "credentials", "aws_access"],
    "network": ["http", "https", "fetch", "axios", "request", "url", "uri", "cors", "tls", "ssl"],
}


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


def _get_repo_file_count(es, owner: str, repo: str) -> int:
    """Get approximate count of unique files in a repository."""
    try:
        if not es.indices.exists(index=INDEX_NAME):
            return 0

        # Use cardinality aggregation to count unique file paths
        response = es.search(
            index=INDEX_NAME,
            body={
                "size": 0,
                "query": {
                    "bool": {
                        "filter": [
                            {"term": {"repo_owner": owner}},
                            {"term": {"repo_name": repo}},
                        ]
                    }
                },
                "aggs": {
                    "unique_files": {
                        "cardinality": {
                            "field": "file_path.keyword"
                        }
                    }
                }
            }
        )
        return response.get("aggregations", {}).get("unique_files", {}).get("value", 0)
    except Exception as e:
        print(f"Warning: Could not get file count: {e}")
        return 0


def _calculate_chunk_limit(file_count: int) -> int:
    """Calculate adaptive chunk limit based on repository size."""
    if file_count < SMALL_REPO_THRESHOLD:
        return SMALL_REPO_CHUNK_LIMIT
    elif file_count < MEDIUM_REPO_THRESHOLD:
        return MEDIUM_REPO_CHUNK_LIMIT
    else:
        return LARGE_REPO_CHUNK_LIMIT


def _is_high_risk_file(file_path: str) -> bool:
    """Check if a file path matches high-risk patterns."""
    file_lower = file_path.lower()
    return any(pattern in file_lower for pattern in HIGH_RISK_FILE_PATTERNS)


def _is_critical_file(file_path: str) -> bool:
    """Check if a file is critical (e.g., dependency or config file)."""
    file_lower = file_path.lower()
    return any(file_lower.endswith(suffix) for suffix in CRITICAL_FILE_SUFFIXES)


def _calculate_heuristic_score(content: str) -> float:
    """Calculate a heuristic score based on security-relevant patterns in content."""
    content_lower = content.lower()
    score = 0.0

    for category, patterns in SECURITY_HEURISTIC_PATTERNS.items():
        for pattern in patterns:
            if pattern.lower() in content_lower:
                # Weight different categories
                if category in ["dangerous_functions", "secrets"]:
                    score += 0.3  # Higher weight for critical patterns
                elif category in ["auth", "crypto"]:
                    score += 0.2
                else:
                    score += 0.1
                break  # Only count once per category

    return score


def _generate_security_query_embeddings(api_key: str) -> List[List[float]]:
    """Generate embeddings for all security-focused queries."""
    try:
        embeddings_model = OpenAIEmbeddings(
            model="text-embedding-ada-002",
            api_key=api_key
        )
        return [embeddings_model.embed_query(query) for query in SECURITY_QUERIES]
    except Exception as e:
        print(f"Warning: Could not generate security query embeddings: {e}")
        return []


def _semantic_search_chunks(
    es,
    owner: str,
    repo: str,
    query_embedding: List[float],
    limit: int,
    file_path: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Perform semantic search for chunks using cosine similarity.
    Returns chunks with their scores.
    """
    filters = [
        {"term": {"repo_owner": owner}},
        {"term": {"repo_name": repo}},
        {"exists": {"field": "embedding"}},
    ]

    if file_path:
        filters.append({"term": {"file_path": file_path}})

    query = {
        "size": limit,
        "query": {
            "script_score": {
                "query": {
                    "bool": {
                        "filter": filters
                    }
                },
                "script": {
                    "source": "cosineSimilarity(params.query_vector, 'embedding') + 1.0",
                    "params": {"query_vector": query_embedding}
                }
            }
        },
        "_source": {
            "includes": ["file_path", "content", "repo_owner", "repo_name", "metadata"]
        }
    }

    try:
        response = es.search(index=INDEX_NAME, body=query)
        hits = response.get("hits", {}).get("hits", [])
        return [
            {
                **hit.get("_source", {}),
                "_score": hit.get("_score", 0.0)
            }
            for hit in hits
        ]
    except Exception as e:
        print(f"Warning: Semantic search failed: {e}")
        return []


def _merge_and_deduplicate_chunks(chunk_lists: List[List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    """
    Merge multiple lists of chunks, deduplicate by content hash, and sort by score.
    """
    seen_content = set()
    merged = []

    for chunk_list in chunk_lists:
        for chunk in chunk_list:
            content = chunk.get("content", "")
            # Simple deduplication using content hash
            content_hash = hash(content)

            if content_hash not in seen_content:
                seen_content.add(content_hash)
                merged.append(chunk)

    # Sort by score (highest first)
    merged.sort(key=lambda x: x.get("_score", 0.0), reverse=True)
    return merged


def _apply_boosting(chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Apply file-type and heuristic boosting to chunk scores.
    """
    for chunk in chunks:
        file_path = chunk.get("file_path", "")
        content = chunk.get("content", "")
        base_score = chunk.get("_score", 1.0)

        boost_multiplier = 1.0

        # File-type boost
        if _is_critical_file(file_path):
            boost_multiplier += 0.5  # 50% boost for critical files
        elif _is_high_risk_file(file_path):
            boost_multiplier += 0.3  # 30% boost for high-risk files

        # Heuristic pattern boost
        heuristic_score = _calculate_heuristic_score(content)
        boost_multiplier += heuristic_score

        chunk["_score"] = base_score * boost_multiplier
        chunk["_boost_applied"] = boost_multiplier

    # Re-sort after boosting
    chunks.sort(key=lambda x: x.get("_score", 0.0), reverse=True)
    return chunks


def _ensure_diversity(chunks: List[Dict[str, Any]], max_per_file: int = 5) -> List[Dict[str, Any]]:
    """
    Ensure diversity by limiting chunks per file.
    This prevents over-representation of any single file.
    """
    file_counts = {}
    diverse_chunks = []

    for chunk in chunks:
        file_path = chunk.get("file_path", "")
        count = file_counts.get(file_path, 0)

        # Always include critical files even if over limit
        if count < max_per_file or _is_critical_file(file_path):
            diverse_chunks.append(chunk)
            file_counts[file_path] = count + 1

    return diverse_chunks


def _force_include_critical_files(
    es,
    owner: str,
    repo: str,
    existing_chunks: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Force-include critical files (dependencies, configs) if not already present.
    """
    existing_paths = {chunk.get("file_path") for chunk in existing_chunks}
    critical_chunks = []

    for suffix in CRITICAL_FILE_SUFFIXES:
        # Search for files ending with this suffix
        query = {
            "size": 1,  # Just get one chunk from each critical file
            "query": {
                "bool": {
                    "filter": [
                        {"term": {"repo_owner": owner}},
                        {"term": {"repo_name": repo}},
                        {"wildcard": {"file_path": f"*{suffix}"}}
                    ]
                }
            },
            "_source": {
                "includes": ["file_path", "content", "repo_owner", "repo_name", "metadata"]
            }
        }

        try:
            response = es.search(index=INDEX_NAME, body=query)
            hits = response.get("hits", {}).get("hits", [])

            for hit in hits:
                file_path = hit["_source"].get("file_path")
                if file_path not in existing_paths:
                    chunk = hit["_source"]
                    chunk["_score"] = 999.0  # High score to ensure inclusion
                    chunk["_critical"] = True
                    critical_chunks.append(chunk)
                    existing_paths.add(file_path)
        except Exception as e:
            print(f"Warning: Could not fetch critical file {suffix}: {e}")
            continue

    return critical_chunks


def _fetch_chunks(
    owner: str,
    repo: str,
    file_path: Optional[str] = None,
    api_key: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Improved chunk retrieval using multi-stage semantic search with boosting.

    This replaces the old timestamp-based retrieval with:
    1. Semantic search across multiple security-focused queries
    2. File-type prioritization (auth, crypto, config files)
    3. Heuristic pattern boosting
    4. Diversity sampling
    5. Force-include critical files

    Args:
        owner: Repository owner
        repo: Repository name
        file_path: Optional specific file path for file-level assessment
        api_key: OpenAI API key for embeddings

    Returns:
        List of chunks sorted by relevance
    """
    es = get_elasticsearch_client()
    if not es.indices.exists(index=INDEX_NAME):
        return []

    # For file-specific assessments, use simpler retrieval
    if file_path:
        return _fetch_chunks_for_file(es, owner, repo, file_path)

    # Stage 1: Multi-query semantic search
    all_chunks = []

    if api_key:
        print("Generating security-focused query embeddings...")
        query_embeddings = _generate_security_query_embeddings(api_key)

        if query_embeddings:
            # Get repo file count for adaptive chunk limit
            file_count = _get_repo_file_count(es, owner, repo)
            chunk_limit = _calculate_chunk_limit(file_count)
            per_query_limit = max(20, chunk_limit // len(SECURITY_QUERIES))

            print(f"Repository has ~{file_count} files, using chunk limit: {chunk_limit}")
            print(f"Running {len(SECURITY_QUERIES)} semantic searches...")

            # Run semantic search for each security query
            chunk_lists = []
            for i, query_embedding in enumerate(query_embeddings):
                chunks = _semantic_search_chunks(
                    es, owner, repo, query_embedding, per_query_limit
                )
                chunk_lists.append(chunks)
                print(f"  Query {i+1}/{len(query_embeddings)}: found {len(chunks)} chunks")

            # Stage 2: Merge and deduplicate
            print("Merging and deduplicating results...")
            all_chunks = _merge_and_deduplicate_chunks(chunk_lists)
            print(f"After deduplication: {len(all_chunks)} unique chunks")

            # Stage 3: Apply file-type and heuristic boosting
            print("Applying security-focused boosting...")
            all_chunks = _apply_boosting(all_chunks)

            # Stage 4: Ensure diversity (limit chunks per file)
            print("Ensuring diversity across files...")
            all_chunks = _ensure_diversity(all_chunks, max_per_file=5)
            print(f"After diversity filtering: {len(all_chunks)} chunks")

            # Stage 5: Force-include critical files
            print("Force-including critical configuration files...")
            critical_chunks = _force_include_critical_files(es, owner, repo, all_chunks)
            if critical_chunks:
                print(f"Added {len(critical_chunks)} critical file chunks")
                all_chunks = critical_chunks + all_chunks

            # Final selection: take top chunks up to limit
            all_chunks = all_chunks[:chunk_limit]
            print(f"Final selection: {len(all_chunks)} chunks for assessment")
        else:
            print("Warning: Could not generate embeddings, falling back to keyword search")
            all_chunks = _fallback_fetch_chunks(es, owner, repo)
    else:
        print("Warning: No API key provided, using fallback retrieval")
        all_chunks = _fallback_fetch_chunks(es, owner, repo)

    # Remove internal scoring fields before returning
    for chunk in all_chunks:
        chunk.pop("_score", None)
        chunk.pop("_boost_applied", None)
        chunk.pop("_critical", None)

    return all_chunks


def _fetch_chunks_for_file(
    es,
    owner: str,
    repo: str,
    file_path: str
) -> List[Dict[str, Any]]:
    """Simple retrieval for file-specific assessments."""
    query = {
        "size": 10,
        "query": {
            "bool": {
                "filter": [
                    {"term": {"repo_owner": owner}},
                    {"term": {"repo_name": repo}},
                    {"term": {"file_path": file_path}},
                ]
            }
        },
        "_source": {
            "includes": ["file_path", "content", "repo_owner", "repo_name", "metadata"]
        }
    }

    response = es.search(index=INDEX_NAME, body=query)
    hits = response.get("hits", {}).get("hits", [])
    return [hit.get("_source", {}) for hit in hits]


def _fallback_fetch_chunks(es, owner: str, repo: str, limit: int = 50) -> List[Dict[str, Any]]:
    """
    Fallback retrieval when embeddings are unavailable.
    Uses keyword search with high-risk file prioritization.
    """
    # Build a query that prioritizes high-risk files
    should_clauses = []

    # Boost queries for high-risk file patterns
    for pattern in HIGH_RISK_FILE_PATTERNS[:10]:  # Use top patterns
        should_clauses.append({
            "wildcard": {
                "file_path": {
                    "value": f"*{pattern}*",
                    "boost": 2.0
                }
            }
        })

    # Also include general match
    should_clauses.append({
        "match_all": {}
    })

    query = {
        "size": limit,
        "query": {
            "bool": {
                "filter": [
                    {"term": {"repo_owner": owner}},
                    {"term": {"repo_name": repo}},
                ],
                "should": should_clauses,
                "minimum_should_match": 0
            }
        },
        "_source": {
            "includes": ["file_path", "content", "repo_owner", "repo_name", "metadata"]
        }
    }

    response = es.search(index=INDEX_NAME, body=query)
    hits = response.get("hits", {}).get("hits", [])
    chunks = [hit.get("_source", {}) for hit in hits]

    # Still apply heuristic boosting and diversity
    for chunk in chunks:
        chunk["_score"] = 1.0 + _calculate_heuristic_score(chunk.get("content", ""))

    chunks.sort(key=lambda x: x.get("_score", 0.0), reverse=True)
    chunks = _ensure_diversity(chunks, max_per_file=5)

    return chunks[:limit]


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
    print(f"\n=== Starting security assessment for {owner}/{repo} ===")
    chunks = _fetch_chunks(owner, repo, api_key=api_key)
    context, sampled_files = _format_context(owner, repo, chunks)
    hints = _derive_hints(context)
    prompt = _build_prompt("repo", owner, repo, context, hints=hints)
    print(f"Invoking LLM for security analysis...")
    parsed = _invoke_model(prompt, api_key)
    print(f"Assessment complete: {len(parsed.get('findings', []))} findings\n")
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

    # For file-level assessment, api_key is not needed (uses simple retrieval)
    chunks = _fetch_chunks(owner, repo, file_path=file_path, api_key=None)
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
