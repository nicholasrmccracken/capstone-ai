# RepoRover

AI-powered GitHub repository analysis assistant that helps understand complex codebases without cloning locally.

## What it does

- **Repository Analysis**: Submit a GitHub URL and get AI-powered insights about the codebase
- **File Processing**: Automatically processes all repository files (code, docs, data)
- **Smart Embeddings**: Uses OpenAI API to create semantic embeddings for intelligent search
- **Chat Interface**: Ask questions about the repository and get contextual answers with file citations

## How it works

1. **Frontend** (Next.js): Simple chat interface for repository URL submission
2. **Backend** (Flask): API endpoint that fetches GitHub repositories via API
3. **Processing** (LangChain): Text splitting and language detection for code files
4. **Embeddings** (OpenAI API): Converts code chunks to vector representations
5. **Search** (Elasticsearch): Vector database for fast semantic search
6. **Response**: Contextual answers with file and line references

## How to run

### Prerequisites
- Python 3.9+, Node.js 18+, Java 8+ for Elasticsearch

## Elasticsearch Setup

RepoRover uses Elasticsearch as its vector database for storing and searching code embeddings. Follow these steps to set up Elasticsearch properly:

### 1. Download Elasticsearch
The project includes Elasticsearch 7.17.9 in the `backend/elasticsearch-7.17.9/` directory. If you need a different version:

1. Visit https://www.elastic.co/downloads/past-releases/elasticsearch-7-17-9
2. Download the ZIP for your platform (Windows users: choose the `.zip` file)
3. Extract to `backend/elasticsearch-7.17.9/`

### 2. Configure Elasticsearch
Elasticsearch requires some basic configuration for this application:

1. **Increase heap size** (recommended for better performance):
   - Open `backend/elasticsearch-7.17.9/config/jvm.options`
   - Set heap size: `-Xms512m` and `-Xmx1g`

2. **Configure network settings** (optional but recommended for development):
   - Open `backend/elasticsearch-7.17.9/config/elasticsearch.yml`
   - Add: `network.host: 0.0.0.0` to allow connections from the app
   - Add: `http.port: 9200` (default, matches the app config)

3. **Security Configuration** (if using authentication):
   - The app supports Elasticsearch authentication
   - Set these in your `.env` file if needed:
     ```
     ES_HOST=http://localhost:9200
     ES_USER=elastic
     ES_PASSWORD=your_password
     ```
   - The app will automatically use these credentials if provided

### 3. Start Elasticsearch
- Windows: `cd backend && elasticsearch-7.17.9\bin\elasticsearch.bat`
- Linux/Mac: `cd backend && ./elasticsearch-7.17.9/bin/elasticsearch`

**Troubleshooting:**
- If you get JVM errors, ensure Java 8+ is installed and JAVA_HOME is set
- If port 9200 is already in use, change the port in both `elasticsearch.yml` and your environment config
- The first startup may take longer as Elasticsearch initializes

### 4. Verify Installation
Once running, visit http://localhost:9200 to see Elasticsearch status. You should see JSON output indicating it's running.

## Quick Start

### 1. Setup Environment
```bash
# Clone repo
git clone <your-repo>
cd capstone-ai

# Create .env with API keys
echo "GITHUB_TOKEN=ghp_your_token_here" > .env
echo "OPENAI_API_KEY=your_openai_api_key" >> .env
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
Frontend (Next.js) → Backend (Flask) → LangChain Processing → OpenAI Embeddings → Elasticsearch Index
```

**Tech Stack**: Python, Flask, OpenAI, LangChain, Elasticsearch, Next.js, Node.js
Data Flow: GitHub API → Repo Processing → AI Embeddings → Vector Search → Chat Response
```
