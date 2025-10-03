from flask import Flask, request, jsonify
from flask_cors import CORS
from ingest_pipeline import ingest_github_repo, search_similar_chunks
from config import OPENAI_API_KEY
import json
from langchain_openai import ChatOpenAI

import os
from github import Github, UnknownObjectException
from dotenv import load_dotenv
from elasticsearch import Elasticsearch
import base64

load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Initialize ChatOpenAI model
if OPENAI_API_KEY:
    llm = ChatOpenAI(
        model="gpt-3.5-turbo",
        temperature=0.1,
        api_key=OPENAI_API_KEY
    )
else:
    llm = None


@app.route("/api/ingest", methods=["POST"])
def ingest():
    github_url = request.json.get("github_url")
    if not github_url:
        return jsonify({"status": "error", "message": "No URL provided"}), 400
    try:
        ingest_github_repo(github_url)
        return jsonify({"status": "started"})
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
        g = Github(github_token)
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
        g = Github(github_token)
        repo_obj = g.get_repo(f"{owner}/{repo}")
        file = repo_obj.get_contents(path, ref=branch)
        content = base64.b64decode(file.content).decode("utf-8")
        return jsonify({"status": "success", "content": content})
    except UnknownObjectException:
        return jsonify({"status": "error", "message": "File not found."}), 404
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/query", methods=["POST"])
def query():
    data = request.json
    query_text = data.get("query")
    github_url = data.get("github_url")
    tagged_files = data.get("tagged_files", [])
    if not query_text or not github_url:
        return jsonify({"status": "error", "message": "Query or URL not provided"}), 400

    try:
        # Extract repo info for tagged file retrieval
        owner, repo = github_url.strip("/").split("/")[-2:]
        github_token = os.getenv("GITHUB_TOKEN")

        if tagged_files:
            # Handle @file tagged queries - fetch full file contents
            file_contexts = []
            for file_path in tagged_files:
                try:
                    g = Github(github_token)
                    repo_obj = g.get_repo(f"{owner}/{repo}")
                    file_content_obj = repo_obj.get_contents(file_path)
                    content = base64.b64decode(file_content_obj.content).decode("utf-8")

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

                except Exception as e:
                    file_contexts.append(f"## File: {file_path}\n\n❌ Error loading file: {str(e)}")

            full_file_context = "\n\n".join(file_contexts)

            prompt = f"""
You are RepoRover, a chatbot that explains GitHub repository files.

The user has tagged specific files using @file syntax. Your task is to explain these files clearly and comprehensively.

Instructions:
- Provide a **complete explanation** of each tagged file
- Structure your response clearly for each file
- Include key functions, classes, and important patterns
- Show **relevant code snippets** to illustrate your points
- Explain the file's purpose, main components, and how it fits into the broader codebase
- Use markdown formatting with file headers and code blocks
- Include line number references where helpful (e.g., "Lines 15-25 define the main class")

Tagged files context:
{full_file_context}

User's question: {query_text}

Provide a detailed explanation focusing on the tagged files:"""

            response = llm.invoke(prompt)
            answer = response.content.strip()

            return jsonify({
                "response": answer,
                "source_files": tagged_files
            })

        else:
            # Original chunk-based search logic
            es_host = os.getenv("ES_HOST")
            es_user = os.getenv("ES_USER")
            es_password = os.getenv("ES_PASSWORD")
            if not es_host or not es_user or not es_password:
                return jsonify({"status": "error", "message": "Elasticsearch credentials not configured."}), 500

            es = Elasticsearch(
                hosts=[es_host],
                basic_auth=(es_user, es_password)
            )

            res = es.search(
                index="repo_chunks",
                body={
                    "query": {
                        "match": {
                            "content": query_text
                        }
                    },
                    "size": 5
                }
            )

            hits = res["hits"]["hits"]
            if not hits:
                return jsonify({"response": "No results found."})

            # Extract unique file paths from search results and deduplicate
            all_source_files = [hit["_source"].get("file_path", "") for hit in hits if hit["_source"].get("file_path")]
            source_files = list(dict.fromkeys(all_source_files))  # Preserve order while removing duplicates

            context = "\n\n".join(
                [hit["_source"].get("content", "No content") for hit in hits])

            prompt = f"""
You are RepoRover, a chatbot that answers questions about GitHub repositories.

Instructions:
- The user does NOT see the raw code context. You must always include any relevant code snippets in your answer. HOWEVER NEVER MENTION "the provided code" as this is invisible to the user.
- When including code, show only the minimal, most relevant lines. Never dump entire files unless absolutely necessary.
- Clearly explain what the code does in simple terms, as if the user has no prior view of it.
- Structure your answers:
  1. Start with an **Explanation** of what the code is doing.
  2. Show **Relevant Code Excerpts** (only the key lines/functions/conditions).
  3. Provide any **step-by-step reasoning or clarification** if needed.
- If the code context is not enough to fully answer, acknowledge this and suggest what additional information might be required.

Format your response in markdown, using headings, bullet points, and code blocks as appropriate. Insert blank lines between sections for readability.

Code context:
{context}

Answer:"""

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
        "GOOGLE_API_KEY": bool(os.getenv("GOOGLE_API_KEY")),
        "ES_HOST": os.getenv("ES_HOST"),
        "ES_USER": os.getenv("ES_USER"),
        "ES_PASSWORD": os.getenv("ES_PASSWORD")
    })


@app.route("/api/test_url", methods=["POST"])
def test_url():
    github_url = request.json.get("github_url")
    owner, repo_name = github_url.strip("/").split("/")[-2:]
    return jsonify({"owner": owner, "repo_name": repo_name})


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
    question = request.json.get("question")
    repo_filter = request.json.get("repo_filter")  # Optional: "owner/repo"

    if not question:
        return jsonify({"status": "error", "message": "No question provided"}), 400

    if not OPENAI_API_KEY:
        return jsonify({"status": "error", "message": "OpenAI API key not configured"}), 500

    try:
        # Search for relevant code chunks
        chunks = search_similar_chunks(question, repo_filter, top_k=5)

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
        prompt = f"""
Based on the following code chunks from a repository, please answer the user's question.
Provide a clear, concise answer with specific details from the code when relevant.

Code context:
{context}

Question: {question}

Answer:"""

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
