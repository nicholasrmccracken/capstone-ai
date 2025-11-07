from flask import Flask, request, jsonify
from flask_cors import CORS
from ingest_pipeline import ingest_github_repo, search_similar_chunks, get_all_repositories, delete_repository
from config import OPENAI_API_KEY
from langchain_openai import ChatOpenAI
from prompts import get_file_tagged_prompt, get_general_query_prompt, get_chat_prompt

import os
from typing import Any, Dict, Optional
from github import Github, UnknownObjectException, Auth
from dotenv import load_dotenv
from elasticsearch import Elasticsearch
import base64

load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

API_KEY_HEADER = "X-OPENAI-API-KEY"


def resolve_openai_api_key(payload: Optional[Dict[str, Any]] = None) -> Optional[str]:
    """
    Determine the OpenAI API key for the current request.

    Priority:
    1. Custom header (X-OPENAI-API-KEY)
    2. Explicit payload field openai_api_key
    3. Server-side environment fallback
    """
    header_key = request.headers.get(API_KEY_HEADER)
    if isinstance(header_key, str) and header_key.strip():
        return header_key.strip()

    if payload:
        body_key = payload.get("openai_api_key")
        if isinstance(body_key, str) and body_key.strip():
            return body_key.strip()

    if OPENAI_API_KEY and OPENAI_API_KEY.strip():
        return OPENAI_API_KEY.strip()

    return None


def build_chat_model(api_key: str) -> ChatOpenAI:
    """
    Create a ChatOpenAI client with common configuration.
    """
    return ChatOpenAI(
        model="gpt-5-nano",
        temperature=0.1,
        api_key=api_key
    )


@app.route("/api/ingest", methods=["POST"])
def ingest():
    payload = request.get_json(silent=True) or {}
    github_url = payload.get("github_url")
    if not github_url:
        return jsonify({"status": "error", "message": "No URL provided"}), 400

    api_key = resolve_openai_api_key(payload)
    if not api_key:
        return jsonify({"status": "error", "message": "OpenAI API key not provided."}), 400

    try:
        ingest_github_repo(github_url, openai_api_key=api_key)
        return jsonify({"status": "completed"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


def generate_ascii_tree(structure, prefix="", indent=""):
    lines = []
    items = sorted(structure.items())
    for index, (key, value) in enumerate(items):
        is_last = index == len(items) - 1
        line_prefix = f"{indent}{'└── ' if is_last else '├── '}"
        lines.append(
            f"{line_prefix}{key}{'/' if isinstance(value, dict) else ''}")
        if isinstance(value, dict):
            new_indent = indent + ("    " if is_last else "│   ")
            lines.extend(generate_ascii_tree(
                value, prefix=f"{prefix}{key}/", indent=new_indent))
    return lines


@app.route("/api/get_tree", methods=["POST"])
def get_tree():
    github_url = request.json.get("github_url")
    if not github_url:
        return jsonify({"status": "error", "message": "No URL provided"}), 400

    github_token = os.getenv("GITHUB_TOKEN")
    if not github_token:
        return jsonify({"status": "error", "message": "GitHub token not configured on server."}), 500

    try:
        owner, repo_name = github_url.strip("/").split("/")[-2:]
        g = Github(auth=Auth.Token(github_token))
        repo = g.get_repo(f"{owner}/{repo_name}")

        default_branch_name = repo.default_branch
        latest_commit = repo.get_commit(sha=default_branch_name)
        tree_items = repo.get_git_tree(latest_commit.sha, recursive=True).tree

        # Build a nested dictionary from the flat list of paths
        files_structure = {}
        for item in tree_items:
            parts = item.path.split('/')
            level = files_structure
            for part in parts[:-1]:
                if part not in level or not isinstance(level[part], dict):
                    level[part] = {}
                level = level[part]
            level[parts[-1]] = '__FILE__'

        return jsonify({
            "status": "success",
            "tree_structure": files_structure,
            "owner": owner,
            "repo": repo_name,
            "default_branch": default_branch_name
        })

    except UnknownObjectException:
        return jsonify({"status": "error", "message": "Repository not found or access denied."}), 404
    except Exception as e:
        print(f"Error fetching tree: {e}")
        return jsonify({"status": "error", "message": f"Could not fetch repository data from GitHub: {str(e)}"}), 500


@app.route("/api/get_file_content", methods=["POST"])
def get_file_content():
    data = request.json
    owner = data.get("owner")
    repo = data.get("repo")
    branch = data.get("branch")
    path = data.get("path")
    if not all([owner, repo, branch, path]):
        return jsonify({"status": "error", "message": "Missing parameters"}), 400

    github_token = os.getenv("GITHUB_TOKEN")
    if not github_token:
        return jsonify({"status": "error", "message": "GitHub token not configured."}), 500

    try:
        g = Github(auth=Auth.Token(github_token))
        repo_obj = g.get_repo(f"{owner}/{repo}")
        file = repo_obj.get_contents(path, ref=branch)

        # Detect file type based on extension
        path_lower = path.lower()

        # Image file extensions
        IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg', '.ico'}

        # Check if file is an image
        if any(path_lower.endswith(ext) for ext in IMAGE_EXTENSIONS):
            content_type_map = {
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.gif': 'image/gif',
                '.bmp': 'image/bmp',
                '.webp': 'image/webp',
                '.svg': 'image/svg+xml',
                '.ico': 'image/x-icon'
            }
            ext = next((e for e in IMAGE_EXTENSIONS if path_lower.endswith(e)), '.png')
            content_type = content_type_map.get(ext, 'image/png')

            return jsonify({
                "status": "success",
                "type": "image",
                "content": file.content,  # Already base64 from PyGithub
                "content_type": content_type,
                "filename": path.split('/')[-1]
            })

        # Check if file is a PDF
        elif path_lower.endswith('.pdf'):
            return jsonify({
                "status": "success",
                "type": "pdf",
                "content": file.content,  # Already base64 from PyGithub
                "filename": path.split('/')[-1]
            })

        # Text files - decode as UTF-8
        else:
            try:
                content = base64.b64decode(file.content).decode("utf-8")
                return jsonify({
                    "status": "success",
                    "type": "text",
                    "content": content
                })
            except UnicodeDecodeError:
                return jsonify({
                    "status": "error",
                    "message": "File is binary and cannot be displayed as text. Supported formats: images (PNG, JPG, GIF, etc.), PDFs, and text files."
                }), 400

    except UnknownObjectException:
        return jsonify({"status": "error", "message": "File not found."}), 404
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/query", methods=["POST"])
def query():
    payload = request.get_json(silent=True) or {}
    query_text = payload.get("query")
    github_url = payload.get("github_url")
    tagged_files = payload.get("tagged_files", [])
    if not query_text or not github_url:
        return jsonify({"status": "error", "message": "Query or URL not provided"}), 400

    api_key = resolve_openai_api_key(payload)
    if not api_key:
        return jsonify({"status": "error", "message": "OpenAI API key not provided."}), 400

    try:
        llm = build_chat_model(api_key)
        # Extract repo info for tagged file retrieval
        owner, repo = github_url.strip("/").split("/")[-2:]
        github_token = os.getenv("GITHUB_TOKEN")

        if tagged_files:
            # Handle @file tagged queries - fetch full file contents
            # Define unsupported binary/media file extensions
            UNSUPPORTED_EXTENSIONS = {
                '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.ico', '.svg',
                '.tiff', '.tif', '.psd', '.ai', '.eps', '.indd',
                '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv', '.3gp',
                '.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', '.m4a',
                '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz',
                '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx',
                '.exe', '.dll', '.so', '.dylib', '.app', '.deb', '.rpm',
                '.iso', '.dmg', '.pkg', '.appimage'
            }

            file_contexts = []
            for file_path in tagged_files:
                # Check if file has an unsupported extension
                file_lower = file_path.lower()
                is_unsupported = any(file_lower.endswith(ext) for ext in UNSUPPORTED_EXTENSIONS)

                if is_unsupported:
                    file_contexts.append(
                        f"## File: {file_path}\n\n"
                        f"📄 This is a binary or media file that cannot be displayed as text. "
                        f"Supported formats include source code and text files."
                    )
                    continue

                try:
                    g = Github(auth=Auth.Token(github_token))
                    repo_obj = g.get_repo(f"{owner}/{repo}")
                    file_content_obj = repo_obj.get_contents(file_path)
                    content = base64.b64decode(
                        file_content_obj.content).decode("utf-8")

                    # Get file extension for syntax highlighting
                    ext = file_path.split('.')[-1] if '.' in file_path else ''
                    lang_map = {
                        'py': 'python', 'js': 'javascript', 'ts': 'typescript',
                        'java': 'java', 'cpp': 'cpp', 'c': 'c', 'cs': 'csharp',
                        'php': 'php', 'rb': 'ruby', 'go': 'go', 'rs': 'rust'
                    }
                    lang = lang_map.get(ext, '')

                    file_contexts.append(f"""## File: {file_path}

```{lang}
{content}
```""")

                except UnicodeDecodeError:
                    file_contexts.append(
                        f"## File: {file_path}\n\n"
                        f"📄 This file appears to be binary and cannot be displayed as text. "
                        f"Supported formats include source code and text files."
                    )
                except Exception as e:
                    file_contexts.append(
                        f"## File: {file_path}\n\n❌ Error loading file: {str(e)}")

            full_file_context = "\n\n".join(file_contexts)

            prompt = get_file_tagged_prompt(full_file_context, query_text)

            response = llm.invoke(prompt)
            answer = response.content.strip()

            return jsonify({
                "response": answer,
                "source_files": tagged_files
            })

        else:
            # Chunk-based semantic search with repository filtering
            repo_filter = f"{owner}/{repo}"
            chunks = search_similar_chunks(
                query_text,
                repo_filter=repo_filter,
                top_k=5,
                openai_api_key=api_key
            )

            if not chunks:
                return jsonify({"response": "No results found."})

            # Extract unique file paths from search results
            source_files = list(dict.fromkeys([chunk["file_path"] for chunk in chunks]))

            # Build context from chunks
            context = "\n\n".join([chunk["content"] for chunk in chunks])

            prompt = get_general_query_prompt(context, query_text)

            response = llm.invoke(prompt)
            answer = response.content.strip()

            return jsonify({
                "response": answer,
                "source_files": source_files
            })

    except Exception as e:
        return jsonify({"status": "error", "message": f"Query failed: {str(e)}"}), 500


@app.route("/api/test_env", methods=["GET"])
def test_env():
    return jsonify({
        "GITHUB_TOKEN": bool(os.getenv("GITHUB_TOKEN")),
        "OPENAI_API_KEY": bool(os.getenv("OPENAI_API_KEY")),
        "ES_HOST": os.getenv("ES_HOST"),
        "ES_USER": os.getenv("ES_USER"),
        "ES_PASSWORD": os.getenv("ES_PASSWORD")
    })


@app.route("/api/test_url", methods=["POST"])
def test_url():
    github_url = request.json.get("github_url")
    owner, repo_name = github_url.strip("/").split("/")[-2:]
    return jsonify({"owner": owner, "repo_name": repo_name})


@app.route("/api/repositories", methods=["GET"])
def list_repositories():
    """List all ingested repositories from Elasticsearch."""
    try:
        repositories = get_all_repositories()
        return jsonify({
            "status": "success",
            "repositories": repositories
        })
    except Exception as e:
        return jsonify({"status": "error", "message": f"Failed to fetch repositories: {str(e)}"}), 500


@app.route("/api/repositories/<owner>/<repo>", methods=["DELETE"])
def delete_single_repository(owner: str, repo: str):
    """Delete a specific repository from Elasticsearch."""
    try:
        deleted_count = delete_repository(owner, repo)

        if deleted_count == 0:
            return jsonify({
                "status": "success",
                "message": f"No chunks found for repository {owner}/{repo}.",
                "deleted_chunks": 0
            })

        return jsonify({
            "status": "success",
            "message": f"Successfully deleted {deleted_count} chunks from {owner}/{repo}.",
            "deleted_chunks": deleted_count
        })
    except Exception as e:
        return jsonify({"status": "error", "message": f"Failed to delete repository: {str(e)}"}), 500


@app.route("/api/clear_repositories", methods=["DELETE"])
def clear_repositories():
    """Clear all repositories from Elasticsearch index."""
    try:
        es_host = os.getenv("ES_HOST")
        es_user = os.getenv("ES_USER")
        es_password = os.getenv("ES_PASSWORD")

        if not es_host or not es_user or not es_password:
            return jsonify({"status": "error", "message": "Elasticsearch credentials not configured."}), 500

        es = Elasticsearch(
            hosts=[es_host],
            basic_auth=(es_user, es_password),
            verify_certs=False
        )

        # Check if index exists
        if not es.indices.exists(index="repo_chunks"):
            return jsonify({"status": "success", "message": "No repositories to clear - index is empty."})

        # Delete all documents from the index
        delete_result = es.delete_by_query(
            index="repo_chunks",
            body={"query": {"match_all": {}}},
            refresh=True
        )

        deleted_count = delete_result["deleted"]

        return jsonify({
            "status": "success",
            "message": f"Successfully cleared {deleted_count} chunks from all repositories.",
            "deleted_chunks": deleted_count
        })

    except Exception as e:
        return jsonify({"status": "error", "message": f"Failed to clear repositories: {str(e)}"}), 500


@app.route("/api/chat", methods=["POST"])
def chat():
    payload = request.get_json(silent=True) or {}
    question = payload.get("question")
    repo_filter = payload.get("repo_filter")  # Optional: "owner/repo"

    if not question:
        return jsonify({"status": "error", "message": "No question provided"}), 400

    api_key = resolve_openai_api_key(payload)
    if not api_key:
        return jsonify({"status": "error", "message": "OpenAI API key not provided."}), 400

    try:
        llm = build_chat_model(api_key)
        # Search for relevant code chunks
        chunks = search_similar_chunks(
            question, repo_filter, top_k=5, openai_api_key=api_key
        )

        if not chunks:
            return jsonify({
                "status": "success",
                "answer": "I couldn't find any relevant code chunks related to your question. Please try rephrasing or ingest some repositories first."
            })

        # Build context from the most relevant chunks
        context = "\n\n".join([
            f"File: {chunk['file_path']}\nRepo: {chunk['repo_owner']}/{chunk['repo_name']}\nCode:\n{chunk['content']}"
            for chunk in chunks
        ])

        # Prepare prompt for the LLM
        prompt = get_chat_prompt(context, question)

        # Generate response using OpenAI
        response = llm.invoke(prompt)
        answer = response.content.strip()

        return jsonify({
            "status": "success",
            "answer": answer,
            "chunks_used": len(chunks),
            "repos": list(set(f"{c['repo_owner']}/{c['repo_name']}" for c in chunks))
        })

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
