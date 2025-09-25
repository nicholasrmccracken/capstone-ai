#!/usr/bin/env python3
"""Test Google Gemini import."""

try:
    from langchain_google_genai import GoogleGenerativeAIEmbeddings
    print("✅ SUCCESS: Google Generative AI embeddings imported successfully!")
except Exception as e:
    print(f"❌ FAILED: Google Generative AI not available ({e})")

try:
    from google.generativeai import configure, embed_content
    print("✅ SUCCESS: Google AI SDK imported successfully!")
except Exception as e:
    print(f"❌ FAILED: Google AI SDK not available ({e})")
