import os
from dotenv import load_dotenv

load_dotenv()

# GitHub Configuration
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

# Elasticsearch Configuration
ES_HOST = os.getenv("ES_HOST", "http://localhost:9200")
ES_USER = os.getenv("ES_USER", "elastic")
ES_PASSWORD = os.getenv("ES_PASSWORD", "changeme")

# AI API Configurations - OpenAI
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Verification
if not GITHUB_TOKEN:
    print("Warning: GITHUB_TOKEN not set. GitHub API may be rate limited.")

if not OPENAI_API_KEY:
    print("Warning: OPENAI_API_KEY not set. Embeddings will not work.")
