import os
from dotenv import load_dotenv

load_dotenv()

# GitHub Configuration
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

# Elasticsearch Configuration
ES_HOST = os.getenv("ES_HOST", "http://localhost:9200")
ES_USER = os.getenv("ES_USER", "elastic")
ES_PASSWORD = os.getenv("ES_PASSWORD", "changeme")

# AI API Configurations - Google Gen AI uses service account authentication
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")  # Legacy API key (may hit quota limits)
GOOGLE_APPLICATION_CREDENTIALS = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")  # Service account key file path

# Verification
if not GITHUB_TOKEN:
    print("Warning: GITHUB_TOKEN not set. GitHub API may be rate limited.")

if not GOOGLE_API_KEY and not GOOGLE_APPLICATION_CREDENTIALS:
    print("Warning: Neither GOOGLE_API_KEY nor GOOGLE_APPLICATION_CREDENTIALS set. Embeddings will not work.")
elif GOOGLE_API_KEY and not GOOGLE_APPLICATION_CREDENTIALS:
    print("Info: Using legacy API key. For higher quota limits, use service account authentication.")
elif GOOGLE_APPLICATION_CREDENTIALS:
    print("Info: Using service account authentication (recommended).")
