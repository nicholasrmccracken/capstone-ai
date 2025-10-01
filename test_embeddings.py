#!/usr/bin/env python3
"""Test OpenAI embeddings functionality."""

import os
import sys

# Add backend to path
sys.path.insert(0, 'backend')

from config import OPENAI_API_KEY
from langchain_openai import OpenAIEmbeddings

print("=== Testing OpenAI Embeddings ===")
print(f"OpenAI API Key configured: {'✓' if OPENAI_API_KEY else '✗'}")
print()

if not OPENAI_API_KEY:
    print("❌ OPENAI_API_KEY not found. Please check your .env file.")
    sys.exit(1)

# Test embedding initialization
print("1. Testing embedding initialization:")
try:
    embeddings_model = OpenAIEmbeddings(
        model="text-embedding-ada-002",
        api_key=OPENAI_API_KEY
    )
    print("   ✅ Embeddings model initialized successfully")
except Exception as e:
    print(f"   ❌ Failed to initialize: {e}")
    sys.exit(1)

# Test single embedding
print("2. Testing single embedding:")
try:
    test_text = "This is a test document for embedding."
    embedding = embeddings_model.embed_query(test_text)
    print("   ✅ Single embedding generated successfully")
    print(f"   Embedding dimension: {len(embedding)}")
    print(f"   Sample values: {embedding[:5]}...")
except Exception as e:
    print(f"   ❌ Failed to generate single embedding: {e}")

# Test batch embeddings
print("3. Testing batch embeddings:")
try:
    test_texts = [
        "This is the first test document.",
        "This is the second test document.",
        "This is the third test document with different content."
    ]
    embeddings = embeddings_model.embed_documents(test_texts)
    print("   ✅ Batch embeddings generated successfully")
    print(f"   Number of embeddings: {len(embeddings)}")
    print(f"   Each embedding dimension: {len(embeddings[0])}")
    print(f"   Sample values: {embeddings[0][:5]}...")
except Exception as e:
    print(f"   ❌ Failed to generate batch embeddings: {e}")

print()
print("=== Test Complete ===")
