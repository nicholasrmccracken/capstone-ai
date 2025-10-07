"""
Ingestion pipeline for processing GitHub repositories.

This module handles the ingestion of code from GitHub repositories into Elasticsearch,
including text splitting, embedding generation, and indexing for semantic search.
"""

from github_utils import get_repo_files, get_file_content
from langchain_community.document_loaders import TextLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_text_splitters import Language
try:
    from langchain_text_splitters import MarkdownHeaderTextSplitter
except ImportError:
    MarkdownHeaderTextSplitter = None
try:
    from langchain_text_splitters import RecursiveJsonSplitter
except ImportError:
    RecursiveJsonSplitter = None
from elasticsearch import Elasticsearch
from config import ES_HOST, ES_USER, ES_PASSWORD, OPENAI_API_KEY
import json
import hashlib
import time
import random
import tempfile
import os
from io import StringIO
from typing import List, Dict, Any, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed

# Import tiktoken for accurate token counting
try:
    import tiktoken
    TIKTOKEN_AVAILABLE = True
except ImportError:
    TIKTOKEN_AVAILABLE = False
    print("Warning: tiktoken not available, using fallback token estimation")

# Configuration for the Elasticsearch index used to store code chunks
INDEX_NAME = "repo_chunks"  # Name of the Elasticsearch index
EMBEDDING_DIM = 1536  # Dimensionality of OpenAI ada-002 embeddings
INDEX_DEFINITION = {
    "mappings": {
        "properties": {
            "repo_owner": {"type": "keyword"},      # GitHub repository owner
            "repo_name": {"type": "keyword"},       # GitHub repository name
            "file_path": {"type": "keyword"},       # Path to the file within the repo
            "content": {"type": "text"},            # Actual code/content of the chunk
            "metadata": {"type": "object"},         # Additional metadata from text splitting
            "embedding": {"type": "dense_vector", "dims": EMBEDDING_DIM},  # Vector embedding for semantic search
            "chunk_id": {"type": "keyword"},        # Unique identifier for the chunk
            "timestamp": {"type": "date", "format": "epoch_second"}  # When the chunk was indexed
        }
    }
}

try:
    from langchain_openai import OpenAIEmbeddings
    OPENAI_AVAILABLE = True
    print("Using real OpenAI embeddings")
except ImportError:
    OPENAI_AVAILABLE = False
    OpenAIEmbeddings = None
    print("Warning: OpenAI not available, embeddings will be skipped")

def generate_chunk_id(owner: str, repo: str, file_path: str, content: str) -> str:
    """Generate a unique ID for a code chunk based on repository and content."""
    unique_string = f"{owner}/{repo}/{file_path}/{content[:100]}"
    return hashlib.md5(unique_string.encode()).hexdigest()

def get_elasticsearch_client():
    """Get configured Elasticsearch client."""
    return Elasticsearch(
        hosts=[ES_HOST],
        basic_auth=(ES_USER, ES_PASSWORD),
        verify_certs=False
    )

def ensure_index(es, recreate_if_invalid=False):
    """Ensure the target index exists with the expected mapping."""
    try:
        if not es.indices.exists(index=INDEX_NAME):
            if recreate_if_invalid:
                es.indices.create(index=INDEX_NAME, body=INDEX_DEFINITION)
                return True
            return False

        mapping = es.indices.get_mapping(index=INDEX_NAME)
        properties = mapping.get(INDEX_NAME, {}).get('mappings', {}).get('properties', {})
        embedding_field = properties.get('embedding')

        if not embedding_field:
            if recreate_if_invalid:
                es.indices.put_mapping(index=INDEX_NAME, body={
                    'properties': {
                        'embedding': {'type': 'dense_vector', 'dims': EMBEDDING_DIM}
                    }
                })
                return True
            return False

        if embedding_field.get('type') != 'dense_vector' or embedding_field.get('dims') != EMBEDDING_DIM:
            if recreate_if_invalid:
                print("Detected incompatible mapping for 'embedding'; recreating index.")
                es.indices.delete(index=INDEX_NAME)
                es.indices.create(index=INDEX_NAME, body=INDEX_DEFINITION)
                return True
            return False

        return True
    except Exception as exc:
        if recreate_if_invalid:
            raise
        print(f"Warning: Unable to verify Elasticsearch index mapping: {exc}")
        return False

def process_file_chunks(owner: str, repo: str, file_path: str) -> Tuple[str, List[str], List[Dict]]:
    """
    Process a single file into chunks with their metadata.

    Returns:
        Tuple of (file_path, chunk_texts, chunk_metadata)
    """
    try:
        # Retrieve the full content of the current file
        content = get_file_content(owner, repo, file_path)
        if not content:  # Skip empty files
            return file_path, [], []

        chunks = []  # Will hold the split document chunks
        chunk_texts = []
        chunk_metadata = []

        # Split the file content into chunks based on file type for optimal processing
        # Different file types need different chunking strategies to preserve semantic meaning

        # For Markdown files: Use hierarchical splitting that respects document structure
        # First split on headers (# ## ###) to keep sections together, then by size
        if file_path.endswith(".md") and MarkdownHeaderTextSplitter is not None:
            headers_to_split_on = [("#", "Header 1"), ("##", "Header 2"), ("###", "Header 3")]
            splitter = MarkdownHeaderTextSplitter(headers_to_split_on)
            md_chunks = splitter.split_text(content)  # Creates chunks preserving header hierarchy
            char_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
            chunks = char_splitter.split_documents(md_chunks)  # Further split large sections
        # For JSON files: Use specialized JSON splitter that preserves object structure
        # Attempts structured splitting first, falls back to text splitting if JSON parsing fails
        elif file_path.endswith(".json") and RecursiveJsonSplitter is not None:
            import json
            try:
                json_data = json.loads(content)  # Parse as JSON object
                splitter = RecursiveJsonSplitter(max_chunk_size=1000)
                chunks = splitter.create_documents(texts=[json_data])  # Structured chunking preserving JSON structure
            except Exception:
                # JSON parsing failed, treat as text file and chunk by size
                with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False, encoding='utf-8') as temp_file:
                    temp_file.write(content)
                    temp_file_path = temp_file.name
                try:
                    loader = TextLoader(temp_file_path)
                    docs = loader.load()
                    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
                    chunks = splitter.split_documents(docs)
                finally:
                    os.unlink(temp_file_path)
        # For JSON files without RecursiveJsonSplitter: Use text-based chunking as fallback
        elif file_path.endswith(".json") and RecursiveJsonSplitter is None:
            with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False, encoding='utf-8') as temp_file:
                temp_file.write(content)
                temp_file_path = temp_file.name
            try:
                loader = TextLoader(temp_file_path)
                docs = loader.load()
                splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
                chunks = splitter.split_documents(docs)
            finally:
                os.unlink(temp_file_path)
        else:
            # For programming languages: Use language-aware chunking that respects code structure
            # Looks up file extension to determine language-specific splitting rules
            ext_language_map = {
                ".py": Language.PYTHON,
                ".js": Language.JS,
                ".ts": Language.TS,
                ".java": Language.JAVA,
                ".go": Language.GO,
                ".cs": Language.CSHARP,
                ".cpp": Language.CPP,
                ".c": Language.C,
                ".php": Language.PHP,
                ".rb": Language.RUBY,
                ".rs": Language.RUST,
                ".scala": Language.SCALA,
                ".swift": Language.SWIFT,
                ".sol": Language.SOL,
                ".kt": Language.KOTLIN,
                ".lua": Language.LUA,
                ".pl": Language.PERL,
                ".hs": Language.HASKELL,
                ".ps1": Language.POWERSHELL,
                ".html": Language.HTML,
                ".tex": Language.LATEX,
                ".md": Language.MARKDOWN,
                ".proto": Language.PROTO,
                ".rst": Language.RST,
                ".cob": Language.COBOL,
                ".ex": Language.ELIXIR,
                ".exs": Language.ELIXIR,
            }
            ext = next((e for e in ext_language_map if file_path.endswith(e)), None)
            if ext:
                language = ext_language_map[ext]
                # Use language-specific splitter that respects syntax (e.g., function boundaries, classes)
                splitter = RecursiveCharacterTextSplitter.from_language(language=language, chunk_size=1000, chunk_overlap=100)
            else:
                # Unknown file type: Use generic character-based chunking
                splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)

            from langchain.schema import Document
            doc = Document(page_content=content, metadata={"source": file_path})
            chunks = splitter.split_documents([doc])  # Standard chunking with 1000 char chunks and 100 char overlap

        # Skip files that didn't produce any chunks (e.g., empty files)
        if not chunks:
            return file_path, [], []

        # Collect all chunks with their metadata
        for chunk in chunks:
            chunk_texts.append(chunk.page_content)
            chunk_metadata.append(chunk.metadata)

        print(f"Processed {len(chunks)} chunks from {file_path}")
        return file_path, chunk_texts, chunk_metadata

    except Exception as e:
        print(f"Error processing {file_path}: {str(e)}")
        return file_path, [], []


def search_similar_chunks(query: str, repo_filter: str = None, top_k: int = 5) -> List[Dict[str, Any]]:
    """
    Search for similar code chunks using hybrid search (semantic + keyword).

    Args:
        query: Search query text
        repo_filter: Optional repository filter (format: "owner/repo")
        top_k: Number of results to return

    Returns:
        List of similar chunks with metadata
    """
    try:
        es = get_elasticsearch_client()

        if not es.indices.exists(index=INDEX_NAME):
            print(f"Warning: Elasticsearch index '{INDEX_NAME}' not found.")
            return []

        should_clauses: List[Dict[str, Any]] = []
        query_embedding = None

        if OPENAI_API_KEY and OPENAI_AVAILABLE:
            if ensure_index(es, recreate_if_invalid=False):
                embeddings_model = OpenAIEmbeddings(
                    model="text-embedding-ada-002",
                    api_key=OPENAI_API_KEY
                )
                query_embedding = embeddings_model.embed_query(query)
                should_clauses.append({
                    "script_score": {
                        "query": {
                            "bool": {
                                "filter": [
                                    {"exists": {"field": "embedding"}}
                                ]
                            }
                        },
                        "script": {
                            "source": "cosineSimilarity(params.query_vector, 'embedding') + 1.0",
                            "params": {"query_vector": query_embedding}
                        }
                    }
                })
            else:
                print("Warning: Dense vector mapping unavailable; using keyword search only.")
        else:
            print("Warning: OPENAI_API_KEY not found. Using keyword search only.")

        should_clauses.append({
            "multi_match": {
                "query": query,
                "fields": ["content", "file_path", "repo_name"]
            }
        })

        search_body = {
            "size": top_k,
            "query": {
                "bool": {
                    "should": should_clauses,
                    "minimum_should_match": 1
                }
            }
        }

        if repo_filter:
            owner, repo = repo_filter.split("/")
            search_body["query"]["bool"].setdefault("filter", [])
            search_body["query"]["bool"]["filter"].extend([
                {"term": {"repo_owner": owner}},
                {"term": {"repo_name": repo}}
            ])

        response = es.search(index=INDEX_NAME, body=search_body)

        results = []
        for hit in response["hits"]["hits"]:
            source = hit["_source"]
            results.append({
                "content": source["content"],
                "file_path": source["file_path"],
                "repo_name": source["repo_name"],
                "repo_owner": source["repo_owner"],
                "metadata": source.get("metadata", {}),
                "score": hit["_score"],
                "chunk_id": source.get("chunk_id")
            })

        return results

    except Exception as e:
        print(f"Error searching chunks: {str(e)}")
        return []


"""
Main ingestion function that processes a GitHub repository into Elasticsearch.

This function fetches all files from the specified GitHub repository, splits them into
manageable chunks using language-appropriate text splitters, generates embeddings in batches,
and indexes everything into Elasticsearch using bulk API for better performance.

See: https://python.langchain.com/docs/concepts/text_splitters/
"""
def ingest_github_repo(github_url: str):
    # Extract repository owner and name from GitHub URL
    owner, repo = github_url.rstrip("/").split("/")[-2:]

    # Initialize Elasticsearch client and ensure the index exists with correct mapping
    es = get_elasticsearch_client()
    try:
        ensure_index(es, recreate_if_invalid=True)
    except Exception as exc:
        print(f"Error ensuring Elasticsearch index: {exc}")
        return

    # Remove existing chunks for this repository to avoid duplicates and stale data
    try:
        delete_query = {
            "query": {
                "bool": {
                    "must": [
                        {"term": {"repo_owner": owner}},
                        {"term": {"repo_name": repo}}
                    ]
                }
            }
        }
        es.delete_by_query(index=INDEX_NAME, body=delete_query, refresh=True)
        print(f"Cleared existing chunks for {owner}/{repo}")
    except Exception as e:
        print(f"Warning: Failed to clear existing chunks: {e}")

    if not OPENAI_API_KEY or not OPENAI_AVAILABLE:
        if not OPENAI_API_KEY:
            print("Warning: OPENAI_API_KEY not found. Skipping embeddings.")
        else:
            print("Warning: OpenAI embeddings library not available. Skipping embeddings.")
        return

    # Initialize the OpenAI embeddings model for generating vector representations
    embeddings_model = OpenAIEmbeddings(
        model="text-embedding-ada-002",
        api_key=OPENAI_API_KEY
    )

    # Fetch all file paths from the GitHub repository
    try:
        files = get_repo_files(owner, repo)
        print(f"Found {len(files)} files in {owner}/{repo}")
    except Exception as e:
        print(f"Error fetching file list: {str(e)}")
        return

    # Parallel Processing: Process multiple files concurrently within GitHub rate limits
    # Use limited concurrency (3-7 threads) to respect GitHub's API rate limits
    all_chunks = []
    all_chunk_metadata = []  # Store (file_path, chunk_metadata) pairs

    # Use ThreadPoolExecutor with limited workers to respect GitHub API rate limits
    # Adjust if necessary based on actual rate limit observations
    repo_worker_min_count = 7
    max_workers = min(repo_worker_min_count, len(files))
    print(f"Processing {len(files)} files with {max_workers} parallel threads...")

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit all file processing tasks
        future_to_file = {
            executor.submit(process_file_chunks, owner, repo, file_path): file_path
            for file_path in files
        }

        # Collect results as they complete
        for future in as_completed(future_to_file):
            file_path = future_to_file[future]
            try:
                _, chunk_texts, chunk_metas = future.result()
                # Collect chunks and their metadata from each completed file
                for i, chunk_text in enumerate(chunk_texts):
                    all_chunks.append(chunk_text)
                    # Recreate the (file_path, metadata) tuple format
                    all_chunk_metadata.append((file_path, chunk_metas[i]))
            except Exception as e:
                print(f"Error processing {file_path}: {str(e)}")
                continue

    print(f"Total chunks collected from all files: {len(all_chunks)}")

    # Batch Processing: Generate embeddings for all chunks with proper token batching
    # This reduces API calls and respects OpenAI rate limits and token limits
    embeddings = []
    if all_chunks:
        try:
            # Split chunks into batches that respect OpenAI's token limits
            # Use a more conservative estimate since the simple character-based estimate can be inaccurate
            MAX_TOKENS_PER_REQUEST = 250000  # More conservative: leave 50k tokens buffer

            # Use tiktoken for accurate token counting if available
            def estimate_tokens(text):
                if TIKTOKEN_AVAILABLE:
                    try:
                        # Use the same encoder that OpenAI uses for text-embedding-ada-002
                        enc = tiktoken.encoding_for_model("text-embedding-ada-002")
                        return len(enc.encode(text))
                    except Exception:
                        pass
                # Fallback to conservative character-based estimation
                return max(1, len(text) // 3)

            current_batch = []
            current_batch_tokens = 0
            batch_count = 0

            for chunk_text in all_chunks:
                chunk_tokens = estimate_tokens(chunk_text)

                # If adding this chunk would exceed the limit, process current batch first
                if current_batch_tokens + chunk_tokens > MAX_TOKENS_PER_REQUEST and current_batch:
                    batch_count += 1
                    print(f"Processing batch {batch_count}: {len(current_batch)} chunks ({current_batch_tokens} tokens)...")
                    try:
                        batch_embeddings = embeddings_model.embed_documents(current_batch)
                        embeddings.extend(batch_embeddings)
                    except Exception as e:
                        # If batch still fails, split into even smaller chunks
                        if "max_tokens_per_request" in str(e):
                            print(f"Batch {batch_count} still too large, splitting into sub-batches...")
                            # Recursively split this batch into smaller sub-batches
                            sub_batch_size = max(1, len(current_batch) // 2)
                            for start_idx in range(0, len(current_batch), sub_batch_size):
                                end_idx = min(start_idx + sub_batch_size, len(current_batch))
                                sub_batch = current_batch[start_idx:end_idx]
                                print(f"Processing sub-batch: {len(sub_batch)} chunks...")
                                batch_embeddings = embeddings_model.embed_documents(sub_batch)
                                embeddings.extend(batch_embeddings)
                        else:
                            raise
                    current_batch = []
                    current_batch_tokens = 0

                # Add chunk to current batch
                current_batch.append(chunk_text)
                current_batch_tokens += chunk_tokens

            # Process final batch
            if current_batch:
                batch_count += 1
                print(f"Processing batch {batch_count}: {len(current_batch)} chunks ({current_batch_tokens} tokens)...")
                batch_embeddings = embeddings_model.embed_documents(current_batch)
                embeddings.extend(batch_embeddings)

            print(f"Successfully generated embeddings for {len(embeddings)} chunks across {batch_count} batches")

        except Exception as e:
            print(f"Error generating embeddings: {str(e)}")
            return

    # Batch indexing with Elasticsearch bulk API
    bulk_actions = []
    timestamp = int(time.time())

    for i, (chunk_text, embedding) in enumerate(zip(all_chunks, embeddings)):
        file_path, metadata = all_chunk_metadata[i]

        doc = {
            "repo_owner": owner,
            "repo_name": repo,
            "file_path": file_path,
            "content": chunk_text,
            "metadata": metadata,
            "embedding": embedding,
            "chunk_id": generate_chunk_id(owner, repo, file_path, chunk_text),
            "timestamp": timestamp
        }

        # Prepare bulk action
        bulk_actions.extend([
            {"index": {"_index": INDEX_NAME, "_id": doc["chunk_id"]}},
            doc
        ])

    # Execute bulk indexing
    if bulk_actions:
        try:
            response = es.bulk(body=bulk_actions, refresh=True)
            if response.get("errors"):
                failed_items = [item for item in response["items"] if item["index"]["status"] >= 400]
                print(f"Bulk indexing completed with {len(failed_items)} failures out of {len(bulk_actions)//2}")
            else:
                print(f"Successfully indexed {len(bulk_actions)//2} chunks via bulk API")
        except Exception as e:
            print(f"Error during bulk indexing: {str(e)}")

    # Refresh the index to make all newly indexed documents immediately searchable
    try:
        es.indices.refresh(index=INDEX_NAME)
    except Exception as refresh_error:
        print(f"Warning: Failed to refresh index: {refresh_error}")
