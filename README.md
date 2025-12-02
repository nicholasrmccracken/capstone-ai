# RepoRover

AI-powered GitHub repository analysis assistant that helps you understand complex codebases without cloning them locally.

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Use Cases](#use-cases)
- [How It Works](#how-it-works)
- [Security Assessments](#security-assessments)
- [Prerequisites](#prerequisites)
- [Installation & Setup](#installation--setup)
  - [Elasticsearch Setup](#elasticsearch-setup)
  - [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)
- [Deployment Considerations](#deployment-considerations)
- [Contributing](#contributing)
- [Security](#security)
- [Support](#support)
- [Roadmap](#roadmap)
- [License](#license)
- [Team](#team)
- [Acknowledgments](#acknowledgments)

## Overview

RepoRover is an intelligent code analysis platform that combines the power of Large Language Models (LLMs), vector databases, and semantic search to help developers quickly understand and analyze GitHub repositories. Whether you're evaluating a new library, conducting security audits, or exploring unfamiliar codebases, RepoRover provides contextual insights with precise file and line references.

### Demo

Access the application at `http://localhost:3000` after setup:

1. Enter a GitHub repository URL (e.g., `https://github.com/microsoft/vscode`)
2. Click "Ingest Repository" to process the codebase
3. Ask questions in natural language
4. Receive AI-powered answers with file citations
5. Click citations to view code directly in the built-in viewer

## Key Features

- **Repository Analysis**: Submit any public GitHub repository URL and get AI-powered insights about the codebase structure, architecture, and implementation
- **Intelligent File Processing**: Automatically processes all repository files including source code, documentation, and configuration files with language detection
- **Semantic Search**: Uses OpenAI embeddings and Elasticsearch vector search for intelligent, context-aware code search
- **Interactive Chat Interface**: Ask natural language questions about the repository and receive contextual answers with precise file citations
- **Security Assessments**: Run comprehensive AI-powered security reviews at both repository and file levels with severity-ranked findings
- **Code Viewer**: Built-in code viewer with markdown rendering for easy file inspection
- **Real-time Processing**: Stream responses and see processing status in real-time

## Use Cases

RepoRover is ideal for:

- **Code Exploration**: Quickly understand unfamiliar codebases without extensive manual navigation
- **Library Evaluation**: Assess third-party libraries before integration into your projects
- **Security Audits**: Identify potential security vulnerabilities in repositories
- **Documentation**: Generate insights about code architecture and implementation details
- **Code Review**: Get AI-powered analysis of pull requests and code changes
- **Learning**: Study well-known open-source projects and understand their implementation patterns
- **Due Diligence**: Technical assessment of codebases during acquisition or partnership decisions

## How It Works

RepoRover follows a multi-stage pipeline to analyze GitHub repositories:

1. **Repository Ingestion**
   - User submits a GitHub repository URL through the web interface
   - Backend fetches repository contents via GitHub API
   - Files are processed and categorized by type (code, docs, config, etc.)

2. **Text Processing**
   - LangChain text splitters chunk files into meaningful segments
   - Language detection identifies file types for optimal processing
   - Code is parsed to maintain context and structure

3. **Embedding Generation**
   - OpenAI's text-embedding model converts each chunk into a high-dimensional vector
   - Vectors capture semantic meaning and relationships between code segments
   - Embeddings are optimized for similarity search

4. **Vector Storage**
   - Elasticsearch stores embeddings with metadata (file path, language, etc.)
   - Vector database enables fast k-nearest neighbor searches
   - Index is optimized for semantic code search

5. **Intelligent Query Processing**
   - User questions are embedded using the same model
   - Semantic search retrieves the most relevant code chunks
   - Context is assembled from top matching segments

6. **AI-Powered Response**
   - OpenAI's chat model generates answers based on retrieved context
   - Responses include file paths and line number citations
   - Streaming enables real-time response display

## Security Assessments

RepoRover now supports first-class security reviews:

- **Repository assessments** analyze the indexed chunks for a repo and generate a JSON report of prioritized findings. Trigger them from the UI next to the ingest button or via `POST /api/security/assess_repo` with `owner`, `repo`, and an OpenAI API key (or `github_url`).
- **File assessments** fetch the latest version of a specific file (plus any available indexed snippets) and audit it in depth. Run them from an open code tab in the UI or call `POST /api/security/assess_file` with `owner`, `repo`, and `file_path`.

Both endpoints return:

```json
{
  "scope": "repo | file",
  "summary": "High-level risk overview",
  "findings": [
    {
      "severity": "high",
      "title": "Hard-coded secret",
      "description": "...",
      "file_path": "backend/app.py",
      "line_hints": "42-58",
      "remediation": "Move the secret to a vault",
      "category": "CWE-798"
    }
  ],
  "sampled_files": ["backend/app.py", "frontend/..."],
  "ran_at": "2025-11-07T15:30:00Z"
}
```

Results are streamed back into chat so you can click cited files to inspect or continue the conversation. If the Elasticsearch index is empty, the backend automatically calls out the limited coverage so you know to ingest before trusting the assessment.

## Prerequisites

Before running RepoRover, ensure you have the following installed:

- **Python 3.9+** - Backend API and processing
- **Node.js 18+** - Frontend application
- **Java 8+** - Required for Elasticsearch
- **npm or yarn** - Package management for frontend
- **pip** - Python package manager

### Required API Keys

You'll need the following API keys to run RepoRover:

1. **GitHub Personal Access Token**
   - Create at: https://github.com/settings/tokens
   - Required scopes: `repo` (for private repos) or `public_repo` (for public repos only)

2. **OpenAI API Key**
   - Get from: https://platform.openai.com/api-keys
   - Used for embeddings and chat completions

### Performance & Cost Estimates

**Typical Repository Processing:**
- Small repository (~50 files): 1-2 minutes, $0.10-$0.30
- Medium repository (~500 files): 5-10 minutes, $0.50-$1.50
- Large repository (~5000 files): 30-60 minutes, $2.00-$10.00

**Hardware Requirements:**
- **Minimum**: 4GB RAM, 2 CPU cores, 10GB disk space
- **Recommended**: 8GB RAM, 4 CPU cores, 20GB disk space
- **For Large Repos**: 16GB RAM, 8 CPU cores, 50GB disk space

**Note**: Elasticsearch is the most resource-intensive component. Costs are for OpenAI API usage only.

## Installation & Setup

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

# Create .env with API keys (see sample template below)
```

**Sample .env file template:**
```env
# GitHub API
GITHUB_TOKEN=ghp_your_github_token_here

# AI API Configurations (use OpenAI)
OPENAI_API_KEY=your_openai_api_key_here

# Elasticsearch Configuration
# For local Elasticsearch (recommended for development):
ES_HOST=http://localhost:9200
ES_USER=elastic
ES_PASSWORD=changeme

# For Docker Elasticsearch:
# ES_HOST=http://localhost:9200
# ES_USER=elastic
# ES_PASSWORD=changeme

# For Elastic Cloud (uncomment and update with your cloud credentials):
# ES_HOST=https://your-deployment-id.es.us-central1.gcp.cloud.es.io:9243
# ES_USER=your-username
# ES_PASSWORD=your-password
```

**Create your .env file:**

Copy the example file and update with your credentials:
```bash
cp .env.example .env
# Then edit .env with your actual API keys
```

Or create manually:
```bash
echo "GITHUB_TOKEN=ghp_your_token_here" > .env
echo "OPENAI_API_KEY=your_openai_api_key" >> .env
echo "ES_HOST=http://localhost:9200" >> .env
echo "ES_USER=elastic" >> .env
echo "ES_PASSWORD=changeme" >> .env
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
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Frontend      │      │    Backend      │      │   External      │
│   (Next.js)     │────▶│    (Flask)      │─────▶│   Services      │
│   Port 3000     │      │    Port 5000    │      │                 │
└─────────────────┘      └─────────────────┘      └─────────────────┘
       │                         │                         │
       │                         │                         │
       ▼                         ▼                         ▼
  User Interface          API Endpoints              GitHub API
  - Chat Interface        - /api/ingest              OpenAI API
  - Code Viewer           - /api/chat                Elasticsearch
  - File Tree             - /api/security/*
  - Markdown Render       - /api/repo/*
```

### Data Flow

1. **Repository Ingestion**: GitHub URL → GitHub API → File Processing → Text Chunking
2. **Embedding Generation**: Code Chunks → OpenAI Embeddings API → Vector Representations
3. **Storage**: Embeddings → Elasticsearch Vector Database → Indexed for Search
4. **Query Processing**: User Question → Semantic Search → Relevant Chunks Retrieved
5. **Response Generation**: Context + Question → OpenAI Chat API → Contextual Answer

### Tech Stack

**Frontend:**
- Next.js 15.5+ (React 19)
- TypeScript
- Tailwind CSS 4
- Framer Motion (animations)
- React Markdown (code rendering)

**Backend:**
- Python 3.9+
- Flask (API framework)
- LangChain (document processing)
- OpenAI API (embeddings & chat)
- Elasticsearch 7.17.9 (vector database)
- PyGithub (GitHub API integration)

## Project Structure

```
capstone-ai/
├── frontend/                 # Next.js frontend application
│   ├── src/
│   │   ├── app/             # Next.js app directory
│   │   │   ├── chat/        # Chat interface page
│   │   │   ├── page.tsx     # Home page
│   │   │   └── layout.tsx   # Root layout
│   │   ├── components/      # React components
│   │   └── lib/             # Utility functions
│   ├── public/              # Static assets
│   └── package.json         # Node dependencies
│
├── backend/                  # Flask backend API
│   ├── app.py               # Main Flask application
│   ├── config.py            # Configuration settings
│   ├── github_utils.py      # GitHub API utilities
│   ├── ingest_pipeline.py   # Repository ingestion logic
│   ├── security_assessment.py # Security scanning logic
│   ├── prompts.py           # LLM prompt templates
│   ├── tests/               # Backend tests
│   └── requirements.txt     # Python dependencies
│
├── .env.example             # Environment variables template
├── .gitignore               # Git ignore rules
└── README.md                # This file
```

## API Documentation

### Repository Management

#### POST `/api/ingest`
Ingest a GitHub repository into the vector database.

**Request:**
```json
{
  "github_url": "https://github.com/owner/repo",
  "openai_api_key": "sk-..."
}
```

**Response:**
```json
{
  "message": "Processing repository...",
  "repo_info": {
    "owner": "owner",
    "repo": "repo",
    "files_processed": 142
  }
}
```

#### GET `/api/repo/<owner>/<repo>/files`
Get the file tree for an ingested repository.

**Response:**
```json
{
  "tree": [
    {
      "path": "src/index.js",
      "type": "file"
    }
  ]
}
```

#### GET `/api/repo/<owner>/<repo>/file`
Get the contents of a specific file.

**Query Parameters:**
- `file_path`: Path to the file in the repository

### Chat & Analysis

#### POST `/api/chat`
Ask questions about an ingested repository.

**Request:**
```json
{
  "owner": "owner",
  "repo": "repo",
  "message": "How does authentication work?",
  "conversation_history": [],
  "openai_api_key": "sk-..."
}
```

**Response:** Streamed text response with citations

### Security Assessment

#### POST `/api/security/assess_repo`
Run security assessment on entire repository.

**Request:**
```json
{
  "owner": "owner",
  "repo": "repo",
  "openai_api_key": "sk-..."
}
```

**Response:**
```json
{
  "scope": "repo",
  "summary": "Found 3 high-severity issues...",
  "findings": [
    {
      "severity": "high",
      "title": "Hard-coded credentials",
      "description": "API key found in source code",
      "file_path": "config/settings.py",
      "line_hints": "23-25",
      "remediation": "Move to environment variables",
      "category": "CWE-798"
    }
  ]
}
```

#### POST `/api/security/assess_file`
Run security assessment on specific file.

**Request:**
```json
{
  "owner": "owner",
  "repo": "repo",
  "file_path": "src/auth.py",
  "openai_api_key": "sk-..."
}
```

## Development

### Running in Development Mode

**Backend Development:**
```bash
cd backend
python app.py  # Runs with debug mode enabled
```

**Frontend Development:**
```bash
cd frontend
npm run dev  # Runs with hot module replacement
```

### Environment Variables

Create a `.env` file in the root directory (see [.env.example](.env.example)):

```env
# GitHub API
GITHUB_TOKEN=ghp_your_github_token_here

# AI API Configurations
OPENAI_API_KEY=sk-your_openai_api_key_here

# Elasticsearch Configuration
ES_HOST=http://localhost:9200
ES_USER=elastic
ES_PASSWORD=changeme
```

### Testing

**Backend Tests:**
```bash
cd backend
python -m pytest tests/
```

**Frontend Linting:**
```bash
cd frontend
npm run lint
```

## Troubleshooting

### Common Issues

**Elasticsearch won't start:**
- Verify Java is installed: `java -version`
- Check if port 9200 is already in use
- Increase heap size in `elasticsearch-7.17.9/config/jvm.options`

**Backend connection errors:**
- Ensure Elasticsearch is running at `http://localhost:9200`
- Verify environment variables are set correctly
- Check firewall settings

**Frontend can't connect to backend:**
- Verify backend is running on port 5000
- Check CORS settings in Flask app
- Ensure API endpoints are correctly configured

**OpenAI API errors:**
- Verify your API key is valid and has credits
- Check rate limits on your OpenAI account
- Ensure you're using a supported model

**GitHub API rate limits:**
- Authenticated requests have higher rate limits
- Use a GitHub token with appropriate permissions
- Check remaining rate limit: https://api.github.com/rate_limit

## FAQ

**Q: Do I need to clone repositories locally?**
A: No, RepoRover fetches repository contents directly via the GitHub API without requiring local clones.

**Q: Can I analyze private repositories?**
A: Yes, if your GitHub token has the appropriate permissions (`repo` scope).

**Q: How much does it cost to run?**
A: Main costs are OpenAI API usage (embeddings + chat). Typical repository analysis costs $0.05-$0.50 depending on size.

**Q: Can I use other LLM providers instead of OpenAI?**
A: Currently, the application is configured for OpenAI. Support for other providers (Anthropic, Azure OpenAI) would require code modifications.

**Q: How large can repositories be?**
A: The system can handle repositories with thousands of files. Very large repositories (>10,000 files) may take longer to process.

**Q: Is the embedding data stored permanently?**
A: Yes, embeddings are stored in Elasticsearch until you delete the index. You only need to ingest a repository once.

**Q: Can I run this in production?**
A: Yes, but you should add authentication, rate limiting, and monitoring. See the deployment considerations below.

## Deployment Considerations

For production deployment, consider:

1. **Security**
   - Add user authentication and authorization
   - Implement rate limiting on API endpoints
   - Use environment-specific API keys
   - Enable HTTPS/TLS for all connections

2. **Scalability**
   - Use managed Elasticsearch (Elastic Cloud)
   - Deploy backend with WSGI server (Gunicorn/uWSGI)
   - Add Redis for caching and job queues
   - Consider horizontal scaling for backend

3. **Monitoring**
   - Add application logging and monitoring
   - Track API usage and costs
   - Monitor Elasticsearch cluster health
   - Set up error tracking (Sentry, etc.)

4. **Performance**
   - Implement caching for frequently accessed repositories
   - Use CDN for frontend static assets
   - Optimize Elasticsearch index settings
   - Batch process large repositories

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and commit: `git commit -am 'Add new feature'`
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request

### Code Style

- **Python**: Follow PEP 8 guidelines
- **JavaScript/TypeScript**: Follow the existing ESLint configuration
- Write descriptive commit messages
- Add tests for new features

## Security

If you discover a security vulnerability, please email the maintainers instead of creating a public issue.

## Support

If you encounter issues or have questions:

1. Check the [Troubleshooting](#troubleshooting) section
2. Review the [FAQ](#faq) section
3. Open an issue on GitHub with:
   - Clear description of the problem
   - Steps to reproduce
   - Error messages or logs
   - Your environment (OS, Node/Python versions)

## Roadmap

Future enhancements planned:

- [ ] Support for additional LLM providers (Anthropic Claude, Azure OpenAI)
- [ ] Private repository analysis with enhanced authentication
- [ ] Diff analysis for comparing commits or branches
- [ ] Code similarity detection across repositories
- [ ] Export reports as PDF or Markdown
- [ ] Team collaboration features
- [ ] Custom security rule definitions
- [ ] Integration with CI/CD pipelines
- [ ] Repository comparison and benchmarking

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Team

RepoRover was developed by:

- **Jemin Gandhi**
- **Nicholas McCracken**
- **Alex Mitelman**
- **Elijah (Eli) Paulman**
- **Blake Theis**

*A capstone project at The Ohio State University*

## Acknowledgments

Built with these technologies:

- **OpenAI** - GPT models and embedding API
- **Elasticsearch** - Vector search and storage
- **LangChain** - Document processing and LLM orchestration
- **Next.js** - React framework for the frontend
- **Flask** - Python web framework for the backend
- **Tailwind CSS** - Utility-first CSS framework
- **PyGithub** - GitHub API integration

---

**Built by the RepoRover team at The Ohio State University** | **Star this repo if you find it useful!**

