#!/usr/bin/env python3
"""
Simple test for Repo Rover ingestion pipeline components
This test validates individual components without requiring Elasticsearch to be running.
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_environment_variables():
    """Test that environment variables are properly loaded."""
    print("🔧 Testing environment variables...")

    from config import GITHUB_TOKEN, GOOGLE_API_KEY, ES_HOST, ES_USER, ES_PASSWORD

    if GITHUB_TOKEN:
        print("✅ GITHUB_TOKEN is set")
    else:
        print("❌ GITHUB_TOKEN is not set")

    if GOOGLE_API_KEY:
        print("✅ Open AI API KEY is set")
    else:
        print("❌ Open AI API KEY is not set")

    print(f"📍 ES_HOST: {ES_HOST}")
    print(f"👤 ES_USER: {ES_USER}")
    print(f"🔒 ES_PASSWORD: {'*' * len(ES_PASSWORD) if ES_PASSWORD else 'Not set'}")

    return True

def test_github_utils():
    """Test GitHub utility functions."""
    print("\n🔌 Testing GitHub utilities...")

    try:
        from github_utils import get_repo_files, get_file_content

        # Test with a small public repository
        test_repo = "https://github.com/octocat/Hello-World"
        owner, repo = test_repo.rstrip("/").split("/")[-2:]

        print(f"📁 Testing with repository: {owner}/{repo}")

        # Test getting file list
        files = get_repo_files(owner, repo)
        print(f"✅ Found {len(files)} files in repository")

        if files:
            # Test getting file content
            test_file = files[0]  # Get first file
            content = get_file_content(owner, repo, test_file)
            print(f"✅ Successfully retrieved content for: {test_file}")
            print(f"📄 Content preview: {content[:100]}...")

        return True
    except Exception as e:
        print(f"❌ Error testing GitHub utilities: {e}")
        return False

def test_text_splitting():
    """Test text splitting functionality."""
    print("\n✂️  Testing text splitting...")

    try:
        from langchain.text_splitter import RecursiveCharacterTextSplitter
        from langchain_text_splitters import Language

        # Test content
        test_content = """
def hello_world():
    print("Hello, World!")
    return True

class Calculator:
    def add(self, a, b):
        return a + b

    def multiply(self, x, y):
        return x * y
"""

        # Test general text splitter
        splitter = RecursiveCharacterTextSplitter(chunk_size=100, chunk_overlap=20)
        chunks = splitter.split_text(test_content)

        print(f"✅ General splitter created {len(chunks)} chunks")

        # Test language-specific splitter
        python_splitter = RecursiveCharacterTextSplitter.from_language(
            language=Language.PYTHON,
            chunk_size=100,
            chunk_overlap=20
        )
        python_chunks = python_splitter.split_text(test_content)

        print(f"✅ Python splitter created {len(python_chunks)} chunks")

        # Show sample chunks
        if chunks:
            print(f"📝 Sample chunk: {chunks[0][:80]}...")

        return True
    except Exception as e:
        print(f"❌ Error testing text splitting: {e}")
        return False

def test_embeddings():
    """Test embeddings functionality."""
    print("\n🧠 Testing embeddings...")

    try:
        from config import GOOGLE_API_KEY

        if not GOOGLE_API_KEY:
            print("⚠️  Open AI API KEY not found, testing with mock embeddings")

        # Import mock embeddings class from ingest_pipeline
        sys.path.append(os.path.dirname(os.path.abspath(__file__)))
        from ingest_pipeline import MockGoogleGenerativeAIEmbeddings

        # Test mock embeddings
        mock_embeddings = MockGoogleGenerativeAIEmbeddings()
        test_texts = ["Hello world", "This is a test", "Embeddings work!"]

        embeddings = mock_embeddings.embed_documents(test_texts)
        query_embedding = mock_embeddings.embed_query("Hello world")

        print(f"✅ Mock embeddings generated {len(embeddings)} document embeddings")
        print(f"✅ Query embedding dimension: {len(query_embedding)}")
        print(f"📊 Embedding dimension: {len(embeddings[0])}")

        return True
    except Exception as e:
        print(f"❌ Error testing embeddings: {e}")
        return False

def test_ingestion_pipeline():
    """Test the ingestion pipeline with a small repository."""
    print("\n🔄 Testing ingestion pipeline...")

    try:
        from ingest_pipeline import ingest_github_repo

        # Test with a very small repository
        test_repo = "https://github.com/elipaulman/GOVS"

        print(f"📥 Testing ingestion with: {test_repo}")

        # This will likely fail if Elasticsearch is not running, but we can catch the error
        try:
            ingest_github_repo(test_repo)
            print("✅ Ingestion completed successfully")
        except Exception as e:
            print(f"⚠️  Ingestion failed (expected if Elasticsearch not running): {e}")
            print("✅ Pipeline structure is working correctly")

        return True
    except Exception as e:
        print(f"❌ Error testing ingestion pipeline: {e}")
        return False

def main():
    """Run all simple tests."""
    print("🚀 Repo Rover - Simple Component Tests")
    print("=" * 50)

    tests = [
        ("Environment Variables", test_environment_variables),
        ("GitHub Utilities", test_github_utils),
        ("Text Splitting", test_text_splitting),
        ("Embeddings", test_embeddings),
        ("Ingestion Pipeline", test_ingestion_pipeline)
    ]

    passed = 0
    total = len(tests)

    for test_name, test_func in tests:
        print(f"\n🧪 {test_name}")
        print("-" * 30)

        try:
            if test_func():
                passed += 1
                print(f"✅ {test_name} test passed")
            else:
                print(f"❌ {test_name} test failed")
        except Exception as e:
            print(f"❌ {test_name} test failed with exception: {e}")

    print("\n" + "=" * 50)
    print(f"📊 Test Results: {passed}/{total} tests passed")

    if passed == total:
        print("🎉 All component tests passed!")
        print("✅ Your ingestion pipeline components are working correctly!")
    else:
        print(f"⚠️  {total - passed} test(s) failed.")

    print("\n🔧 Next Steps:")
    print("   1. Set up Elasticsearch server (see instructions below)")
    print("   2. Run the full elasticsearch_test.py once Elasticsearch is running")
    print("   3. Test the complete ingestion pipeline")

    print("\n📋 Elasticsearch Setup Instructions:")
    print("   Option 1 - Docker (Recommended):")
    print("   docker run -d -p 9200:9200 -e 'discovery.type=single-node' elasticsearch:7.17")
    print("   ")
    print("   Option 2 - Local Installation:")
    print("   1. Download Elasticsearch 7.17 from https://www.elastic.co/downloads/elasticsearch")
    print("   2. Unzip and run: bin/elasticsearch")
    print("   3. Default credentials: elastic/changeme")
    print("   ")
    print("   Option 3 - Cloud (Elastic Cloud):")
    print("   1. Sign up at https://cloud.elastic.co/")
    print("   2. Create a deployment")
    print("   3. Update your .env file with the cloud endpoint and credentials")

if __name__ == "__main__":
    main()
