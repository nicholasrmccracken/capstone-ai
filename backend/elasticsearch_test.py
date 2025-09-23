#!/usr/bin/env python3
"""
Comprehensive Elasticsearch test for Repo Rover ingestion pipeline
This test validates the complete pipeline with real Elasticsearch indexing and search.
"""

import os
import time
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_elasticsearch_connection():
    """Test Elasticsearch connection and setup."""
    print("🔌 Testing Elasticsearch connection...")

    try:
        from elasticsearch import Elasticsearch
        from config import ES_HOST, ES_USER, ES_PASSWORD

        es = Elasticsearch(
            hosts=[ES_HOST],
            basic_auth=(ES_USER, ES_PASSWORD),
            verify_certs=False
        )

        # Test connection
        if es.ping():
            print("✅ Elasticsearch connection successful")
        else:
            print("❌ Elasticsearch connection failed")
            return False

        # Get cluster info
        info = es.info()
        version = info['version']['number']
        print(f"✅ Elasticsearch version: {version}")

        return es
    except Exception as e:
        print(f"❌ Error connecting to Elasticsearch: {e}")
        return None

def test_index_management():
    """Test Elasticsearch index creation and management."""
    print("\n📦 Testing index management...")

    try:
        es = test_elasticsearch_connection()
        if not es:
            return False

        index_name = "repo_chunks"

        # Check if index exists
        if es.indices.exists(index=index_name):
            print(f"✅ Index '{index_name}' already exists")
            # Delete existing index for clean test
            es.indices.delete(index=index_name)
            print(f"🗑️  Deleted existing index '{index_name}' for clean test")
        else:
            print(f"✅ Index '{index_name}' does not exist")

        # Create index with proper mappings
        print(f"📦 Creating index '{index_name}'...")
        es.indices.create(index=index_name, body={
            "mappings": {
                "properties": {
                    "repo_owner": {"type": "keyword"},
                    "repo_name": {"type": "keyword"},
                    "file_path": {"type": "keyword"},
                    "content": {"type": "text"},
                    "embedding": {"type": "dense_vector", "dims": 768},
                    "chunk_id": {"type": "keyword"},
                    "timestamp": {"type": "date"}
                }
            }
        })
        print(f"✅ Created index '{index_name}' with proper mappings")

        # Verify index
        mapping = es.indices.get_mapping(index=index_name)
        print(f"✅ Index mapping verified: {list(mapping[index_name]['mappings']['properties'].keys())}")

        return True
    except Exception as e:
        print(f"❌ Error in index management: {e}")
        return False

def test_data_ingestion():
    """Test ingesting data into Elasticsearch."""
    print("\n📥 Testing data ingestion...")

    try:
        from ingest_pipeline import ingest_github_repo, get_elasticsearch_client

        es = get_elasticsearch_client()
        if not es:
            print("❌ Cannot test ingestion without Elasticsearch connection")
            return False

        # Ingest repository
        repo_url = "https://github.com/elipaulman/GOVS"
        print(f"Starting ingestion of {repo_url}...")

        start_time = time.time()
        ingest_github_repo(repo_url)
        end_time = time.time()

        ingestion_time = end_time - start_time
        print(f"✅ Ingestion completed in {ingestion_time:.2f} seconds")

        # Verify data was indexed
        index_name = "repo_chunks"
        count_result = es.count(index=index_name)
        doc_count = count_result["count"]
        print(f"✅ Indexed {doc_count} chunks in Elasticsearch")

        if doc_count > 0:
            # Get sample documents
            search_result = es.search(index=index_name, body={
                "size": 3,
                "query": {"match_all": {}}
            })

            print("✅ Sample indexed documents:")
            for i, hit in enumerate(search_result["hits"]["hits"], 1):
                source = hit["_source"]
                print(f"  {i}. {source['file_path']} ({source['repo_name']})")
                print(f"     Content: {source['content'][:100]}...")
                print(f"     Chunk ID: {source['chunk_id']}")

            return True
        else:
            print("⚠️  No documents were indexed")
            return False

    except Exception as e:
        print(f"❌ Error during data ingestion: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_search_functionality():
    """Test search functionality against indexed data."""
    print("\n🔍 Testing search functionality...")

    try:
        from ingest_pipeline import search_similar_chunks, get_elasticsearch_client

        es = get_elasticsearch_client()
        if not es:
            print("❌ Cannot test search without Elasticsearch connection")
            return False

        # Check if we have data to search
        index_name = "repo_chunks"
        count_result = es.count(index=index_name)
        doc_count = count_result["count"]

        if doc_count == 0:
            print("⚠️  No data available for search testing")
            return False

        print(f"🔍 Searching through {doc_count} indexed chunks...")

        # Test different search queries
        test_queries = [
            "CSV",
            "processing",
            "function",
            "class",
            "python",
            "README"
        ]

        for query in test_queries:
            print(f"\n🔍 Searching for: '{query}'")
            results = search_similar_chunks(query, top_k=5)

            if results:
                print(f"✅ Found {len(results)} results:")
                for i, result in enumerate(results, 1):
                    print(f"  {i}. {result['file_path']} (score: {result['score']:.3f})")
                    print(f"     Content: {result['content'][:120]}...")
                    print(f"     Repository: {result['repo_owner']}/{result['repo_name']}")
            else:
                print("  No results found")

        return True
    except Exception as e:
        print(f"❌ Error during search testing: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_hybrid_search():
    """Test hybrid search (semantic + keyword)."""
    print("\n🔍 Testing hybrid search...")

    try:
        from ingest_pipeline import search_similar_chunks, get_elasticsearch_client

        es = get_elasticsearch_client()
        if not es:
            print("❌ Cannot test hybrid search without Elasticsearch connection")
            return False

        # Test hybrid search with specific queries
        test_cases = [
            {
                "query": "CSV processing tool",
                "description": "Semantic search for CSV functionality"
            },
            {
                "query": "python function",
                "description": "Mixed semantic and keyword search"
            },
            {
                "query": "class definition",
                "description": "Search for class-related code"
            }
        ]

        for test_case in test_cases:
            print(f"\n🔍 {test_case['description']}: '{test_case['query']}'")
            results = search_similar_chunks(test_case['query'], top_k=3)

            if results:
                print(f"✅ Found {len(results)} results:")
                for i, result in enumerate(results, 1):
                    print(f"  {i}. {result['file_path']} (score: {result['score']:.3f})")
                    print(f"     Content: {result['content'][:100]}...")
            else:
                print("  No results found")

        return True
    except Exception as e:
        print(f"❌ Error during hybrid search testing: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_performance():
    """Test performance metrics."""
    print("\n⚡ Testing performance...")

    try:
        from ingest_pipeline import get_elasticsearch_client

        es = get_elasticsearch_client()
        if not es:
            print("❌ Cannot test performance without Elasticsearch connection")
            return False

        index_name = "repo_chunks"

        # Test search performance
        start_time = time.time()
        results = es.search(index=index_name, body={
            "size": 10,
            "query": {"match_all": {}}
        })
        search_time = time.time() - start_time

        doc_count = results["hits"]["total"]["value"]
        print(f"✅ Search performance: {search_time:.3f}s for {doc_count} documents")

        # Test aggregation performance
        start_time = time.time()
        agg_result = es.search(index=index_name, body={
            "size": 0,
            "aggs": {
                "by_file": {
                    "terms": {"field": "file_path", "size": 10}
                },
                "by_repo": {
                    "terms": {"field": "repo_name", "size": 5}
                }
            }
        })
        agg_time = time.time() - start_time

        print(f"✅ Aggregation performance: {agg_time:.3f}s")
        print(f"   Files indexed: {len(agg_result['aggregations']['by_file']['buckets'])}")
        print(f"   Repositories: {len(agg_result['aggregations']['by_repo']['buckets'])}")

        return True
    except Exception as e:
        print(f"❌ Error during performance testing: {e}")
        return False

def main():
    """Run all Elasticsearch tests."""
    print("🚀 Repo Rover - Comprehensive Elasticsearch Test")
    print("=" * 60)

    tests = [
        ("Elasticsearch Connection", test_elasticsearch_connection),
        ("Index Management", test_index_management),
        ("Data Ingestion", test_data_ingestion),
        ("Search Functionality", test_search_functionality),
        ("Hybrid Search", test_hybrid_search),
        ("Performance", test_performance)
    ]

    passed = 0
    total = len(tests)

    for test_name, test_func in tests:
        print(f"\n🧪 {test_name}")
        print("-" * 40)

        try:
            if test_func():
                passed += 1
                print(f"✅ {test_name} test passed")
            else:
                print(f"❌ {test_name} test failed")
        except Exception as e:
            print(f"❌ {test_name} test failed with exception: {e}")

    print("\n" + "=" * 60)
    print(f"📊 Test Results: {passed}/{total} tests passed")

    if passed == total:
        print("🎉 All Elasticsearch tests passed!")
        print("🚀 Your ingestion pipeline is fully functional with Elasticsearch!")
    else:
        print(f"⚠️  {total - passed} test(s) failed.")
        print("💡 Check the output above for details and ensure Elasticsearch is running.")

    print("\n🔧 Troubleshooting:")
    print("   1. Ensure Elasticsearch is running on https://localhost:9200")
    print("   2. Check your .env file has correct ES_USER and ES_PASSWORD")
    print("   3. Verify GOOGLE_API_KEY is set for embeddings")
    print("   4. Make sure all Python dependencies are installed")

if __name__ == "__main__":
    main()
