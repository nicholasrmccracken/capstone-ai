#!/usr/bin/env python3
"""Test OpenAI import."""

try:
    from langchain_openai import OpenAIEmbeddings
    print("✅ SUCCESS: OpenAI embeddings imported successfully!")
except Exception as e:
    print(f"❌ FAILED: OpenAI not available ({e})")

try:
    import openai
    print("✅ SUCCESS: OpenAI SDK imported successfully!")
except Exception as e:
    print(f"❌ FAILED: OpenAI SDK not available ({e})")
