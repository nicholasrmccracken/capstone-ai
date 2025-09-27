#!/usr/bin/env python3
"""Test Google Generative AI embeddings functionality."""

import os
import sys

# Add backend to path
sys.path.insert(0, 'backend')

from config import GOOGLE_API_KEY
from langchain_google_genai import GoogleGenerativeAIEmbeddings

print("=== Testing Google Generative AI Embeddings ===")
print(f"Google API Key configured: {'✓' if GOOGLE_API_KEY else '✗'}")
print()

if not GOOGLE_API_KEY:
    print("❌ GOOGLE_API_KEY not found. Please check your .env file.")
    sys.exit(1)

# Test embedding initialization
print("1. Testing embedding initialization:")
try:
    embeddings_model = GoogleGenerativeAIEmbeddings(
        model="models/embedding-001",
        google_api_key=GOOGLE_API_KEY
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
