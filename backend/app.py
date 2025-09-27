from flask import Flask, request, jsonify
from flask_cors import CORS
from ingest_pipeline import ingest_github_repo

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

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

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
