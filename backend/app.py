from flask import Flask, request, jsonify
from flask_cors import CORS
from ingest_pipeline import ingest_github_repo, search_similar_chunks
from config import OPENAI_API_KEY
import json
from langchain_openai import ChatOpenAI

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
