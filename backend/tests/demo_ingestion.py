#!/usr/bin/env python3
"""
Demo script showing RepoRover backend ingestion pipeline progress.
This script simulates the full ingestion flow without hitting external APIs.
"""

import time
import random
from typing import List

class DemoEmbeddings:
    """Mock embeddings for demo purposes."""
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        time.sleep(0.5)  # Simulate processing time
        return [[random.random() for _ in range(768)] for _ in texts]

class DemoElasticsearch:
    """Mock Elasticsearch for demo purposes."""
    def __init__(self):
        self.indexed_chunks = 0

    def index(self, index: str, body: dict):
        time.sleep(0.1)  # Simulate indexing time
        self.indexed_chunks += 1
        return {"_id": f"mock_{self.indexed_chunks}"}

def simulate_github_fetch(owner: str, repo: str) -> List[str]:
    """Simulate fetching files from a GitHub repository."""
    print(f"🔍 Fetching repository metadata: {owner}/{repo}")
    time.sleep(1)

    # Mock some file paths
    files = [
        f"src/main.{ext}" for ext in ["py", "js", "ts", "java"]
    ] + [
        "README.md",
        "package.json",
        ".gitignore",
        "docs/api.md"
    ]

    for file_path in files:
        print(f"📄 Discovered file: {file_path}")

    print(f"✅ Found {len(files)} processable files")
    return files

def simulate_file_content(owner: str, repo: str, file_path: str) -> str:
    """Simulate fetching content for a specific file."""
    print(f"📥 Downloading content: {file_path}")
    time.sleep(0.3)

    # Mock content based on file type
    if file_path.endswith(".md"):
        content = f"# {file_path}\n\nThis is sample markdown content for {repo}.\n\n## Features\n\n- Feature 1\n- Feature 2"
    elif file_path.endswith(".json"):
        content = '{"name": "sample-repo", "version": "1.0.0", "dependencies": {"lib": "^1.0"}}'
    else:
        content = f"""# Sample {file_path.split('.')[-1].upper()} code
def hello_world():
    print("Hello from {repo}!")

class Demo:
    def __init__(self):
        self.value = 42

if __name__ == "__main__":
    app = Demo()
    hello_world()
"""

    return content

def simulate_text_splitting(content: str, file_path: str) -> List[str]:
    """Simulate LangChain text splitting."""
    print(f"✂️  Splitting text into chunks: {file_path}")

    # Simple mock splitting
    sentences = content.split('\n')
    chunks = []
    current_chunk = ""
    chunk_size = 0

    for sentence in sentences:
        if chunk_size + len(sentence) > 1000:
            chunks.append(current_chunk.strip())
            current_chunk = sentence
            chunk_size = len(sentence)
        else:
            current_chunk += "\n" + sentence
            chunk_size += len(sentence)

    if current_chunk:
        chunks.append(current_chunk.strip())

    print(f"📦 Created {len(chunks)} text chunks ({sum(len(c) for c in chunks)} characters total)")
    return chunks

def simulate_embeddings_generation(chunks: List[str]) -> List[List[float]]:
    """Simulate Open AI API embeddings generation."""
    print("🧠 Generating embeddings with Open AI API")

    embeddings_model = DemoEmbeddings()

    start_time = time.time()
    embeddings = embeddings_model.embed_documents(chunks)
    elapsed = time.time() - start_time

    print(f"🤖 Generated {len(embeddings)} embeddings in {elapsed:.2f} seconds")
    return embeddings
def simulate_elasticsearch_indexing(chunks: List[str], embeddings: List[List[float]],
                                   owner: str, repo: str, file_path: str):
    """Simulate indexing chunks in Elasticsearch."""
    print("📊 Indexing chunks in Elasticsearch vector database")

    es = DemoElasticsearch()

    indexed = 0
    for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        # Mock document
        doc = {
            "repo_owner": owner,
            "repo_name": repo,
            "file_path": file_path,
            "content": chunk,
            "metadata": {"chunk_index": i},
            "embedding": embedding,
            "chunk_id": f"demo_{i}",
            "timestamp": int(time.time())
        }

        result = es.index("repo_chunks", doc)
        indexed += 1

        if indexed % 3 == 0:
            print(f"✅ Indexed {indexed}/{len(chunks)} chunks")

    print(f"🎉 Successfully indexed all {len(chunks)} chunks from {file_path}")

def main():
    """Main demo script."""
    print("🚀 RepoRover Backend Ingestion Pipeline Demo")
    print("=" * 50)

    # Simulate a sample repository
    owner = "microsoft"
    repo = "vscode"
    github_url = f"https://github.com/{owner}/{repo}"

    print(f"📋 Starting ingestion for repository: {github_url}")
    print()

    # Step 1: Fetch repository files
    files = simulate_github_fetch(owner, repo)
    print()

    # Process a few files for demo (limit to keep it fast)
    demo_files = files[:3]  # Process first 3 files

    for i, file_path in enumerate(demo_files):
        print(f"🔄 Processing file {i+1}/{len(demo_files)}: {file_path}")

        # Step 2: Get file content
        content = simulate_file_content(owner, repo, file_path)
        print(f"📏 Content length: {len(content)} characters")

        # Step 3: Split text
        chunks = simulate_text_splitting(content, file_path)

        # Step 4: Generate embeddings
        embeddings = simulate_embeddings_generation(chunks)

        # Step 5: Index in Elasticsearch
        simulate_elasticsearch_indexing(chunks, embeddings, owner, repo, file_path)

        print(f"✅ Completed processing: {file_path}")
        print()

    print("🎊 Repository ingestion complete!")
    print(f"📈 Total files processed: {len(demo_files)}")
    print(f"🏗️  Pipeline ready for semantic search and Q&A features")
    print("\n💡 Next steps: Integrate chat interface for natural language queries")

if __name__ == "__main__":
    main()
