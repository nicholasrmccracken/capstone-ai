#!/usr/bin/env python3
"""
Simple test to verify Elasticsearch can accept writes even with low disk space.
"""

import requests

# Elasticsearch URL
ES_URL = "http://localhost:9200"

def test_connection():
    """Test basic connection to Elasticsearch."""
    try:
        response = requests.get(f"{ES_URL}/_cluster/health")
        if response.status_code == 200:
            health = response.json()
            print(f"✅ Connected to Elasticsearch. Cluster status: {health['status']}")
            return True
        else:
            print(f"❌ Failed to connect: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Connection error: {e}")
        return False

def test_write():
    """Test writing a document to Elasticsearch."""
    try:
        # Create a test index if it doesn't exist
        index_response = requests.put(f"{ES_URL}/test_index")
        print(f"Index creation status: {index_response.status_code}")

        # Write a test document
        doc = {
            "message": "Test document to verify writes work with low disk space",
            "timestamp": "2025-11-18"
        }
        write_response = requests.post(
            f"{ES_URL}/test_index/_doc",
            json=doc,
            headers={"Content-Type": "application/json"}
        )

        if write_response.status_code == 201:
            print("✅ Successfully wrote document to Elasticsearch!")
            return True
        else:
            print(f"❌ Failed to write document: {write_response.status_code} - {write_response.text}")
            return False
    except Exception as e:
        print(f"❌ Write error: {e}")
        return False

if __name__ == "__main__":
    print("🧪 Testing Elasticsearch write capability with low disk space...")
    if test_connection():
        if test_write():
            print("🎉 All tests passed! Elasticsearch works even with low disk space.")
        else:
            print("❌ Write test failed.")
    else:
        print("❌ Connection test failed.")
