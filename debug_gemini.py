#!/usr/bin/env python3
"""Debug Google Gemini import issues."""

print("=== Testing Google Generative AI Imports ===")
print(f"Python version: {__import__('sys').version}")
print()

# Test 1: Basic import attempt
print("1. Testing basic import of langchain_google_genai:")
try:
    import langchain_google_genai
    print("   ✅ Imports successfully")
    print(f"   Version: {getattr(langchain_google_genai, '__version__', 'unknown')}")
except Exception as e:
    print(f"   ❌ Failed: {e}")
print()

# Test 2: Specific class import
print("2. Testing import of GoogleGenerativeAIEmbeddings:")
try:
    from langchain_google_genai import GoogleGenerativeAIEmbeddings
    print("   ✅ Imports successfully")
    print(f"   Class: {GoogleGenerativeAIEmbeddings}")
except Exception as e:
    print(f"   ❌ Failed: {e}")
    import traceback
    traceback.print_exc()
print()

# Test 3: Direct google.generativeai import
print("3. Testing direct google.generativeai import:")
try:
    import google.generativeai as genai
    print("   ✅ Imports successfully")
    print(f"   Version: {getattr(genai, '__version__', 'unknown')}")
except Exception as e:
    print(f"   ❌ Failed: {e}")
print()

# Test 4: Check for circular import in submodules
print("4. Testing google.ai.generativelanguage imports:")
modules_to_test = [
    'google.ai.generativelanguage_v1beta.services.model_service',
    'google.ai.generativelanguage_v1.services.model_service',
    'google.ai.generativelanguage_v1beta',
]

for module in modules_to_test:
    try:
        __import__(module)
        print(f"   ✅ {module} imports successfully")
    except Exception as e:
        print(f"   ❌ {module} failed: {e}")
print()

print("=== Environment Info ===")
import sys
print(f"Python path: {sys.path[:3]}...")  # Show first 3 paths
print("Installed packages related to Google:")
import subprocess
try:
    result = subprocess.run([sys.executable, '-m', 'pip', 'list', '--format=freeze'],
                          capture_output=True, text=True, timeout=10)
    google_packages = [line for line in result.stdout.split('\n')
                      if 'google' in line.lower() or 'langchain' in line.lower()]
    for pkg in sorted(google_packages):
        if pkg.strip():
            print(f"  {pkg}")
except Exception as e:
    print(f"  Could not list packages: {e}")
