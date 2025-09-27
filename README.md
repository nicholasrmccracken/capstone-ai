# RepoRover

AI-powered GitHub repository analysis assistant that helps understand complex codebases without cloning locally.

## What it does

- **Repository Analysis**: Submit a GitHub URL and get AI-powered insights about the codebase
- **File Processing**: Automatically processes all repository files (code, docs, data)
- **Smart Embeddings**: Uses Google Gen AI to create semantic embeddings for intelligent search
- **Chat Interface**: Ask questions about the repository and get contextual answers with file citations

## How it works

1. **Frontend** (Next.js): Simple chat interface for repository URL submission
2. **Backend** (Flask): API endpoint that fetches GitHub repositories via API
3. **Processing** (LangChain): Text splitting and language detection for code files
4. **Embeddings** (Google Gen AI): Converts code chunks to vector representations
5. **Search** (Elasticsearch): Vector database for fast semantic search
6. **Response**: Contextual answers with file and line references

## How to run

### Prerequisites
- Python 3.9+, Node.js 18+, Java 8+ for Elasticsearch

### 1. Setup Environment
```bash
# Clone repo
git clone <your-repo>
cd capstone-ai

# Create .env with API keys
echo "GITHUB_TOKEN=ghp_your_token_here" > .env
echo "GOOGLE_API_KEY=your_google_ai_key" >> .env
```

### 2. Backend Setup
```bash
cd backend
pip install -r requirements.txt
```

### 3. Frontend Setup
```bash
cd frontend
npm install
```

### 4. Start Services
```bash
# Terminal 1: Elasticsearch
cd backend
./elasticsearch-7.17.9/bin/elasticsearch.bat  # Windows

# Terminal 2: Backend API
cd backend
python app.py                                # Runs on port 5000

# Terminal 3: Frontend
cd frontend
npm run dev                                  # Runs on port 3000
```

### 5. Use the App
- Visit `http://localhost:3000` to access the chat interface
- Submit any GitHub repository URL (e.g., `https://github.com/microsoft/vscode`)
- Repository gets ingested and you can ask questions about it

## Architecture

```
Frontend (Next.js) → Backend (Flask) → LangChain Processing → Google Gen AI Embeddings → Elasticsearch Index
```

**Tech Stack**: Python, Flask, Google Gen AI, LangChain, Elasticsearch, Next.js, Node.js
Data Flow: GitHub API → Repo Processing → AI Embeddings → Vector Search → Chat Response
```
