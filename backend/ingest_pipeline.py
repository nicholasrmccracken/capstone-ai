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
from typing import List, Dict, Any

INDEX_NAME = "repo_chunks"
EMBEDDING_DIM = 1536
INDEX_DEFINITION = {
    "mappings": {
        "properties": {
            "repo_owner": {"type": "keyword"},
            "repo_name": {"type": "keyword"},
            "file_path": {"type": "keyword"},
            "content": {"type": "text"},
            "metadata": {"type": "object"},
            "embedding": {"type": "dense_vector", "dims": EMBEDDING_DIM},
            "chunk_id": {"type": "keyword"},
            "timestamp": {"type": "date", "format": "epoch_second"}
        }
    }
}

# Mock embeddings for testing when OpenAI has compatibility issues
class MockOpenAIEmbeddings:
    """Mock embeddings class for testing when OpenAI has compatibility issues."""

    def __init__(self, model="text-embedding-ada-002", api_key=None):
        self.model = model
        self.api_key = api_key

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Generate mock embeddings for testing."""
        return [[random.random() for _ in range(1536)] for _ in texts]  # ada-002 is 1536

    def embed_query(self, text: str) -> List[float]:
        """Generate mock embedding for a single query."""
        return [random.random() for _ in range(1536)]

# Try to import OpenAI, fall back to mock if it fails
try:
    from langchain_openai import OpenAIEmbeddings
    print("Using real OpenAI embeddings")
except Exception as e:
    print(f"Warning: OpenAI not available ({e}), using mock embeddings for testing")
    OpenAIEmbeddings = MockOpenAIEmbeddings

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

        if OPENAI_API_KEY:
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


# langchain splitter documentation: https://python.langchain.com/docs/concepts/text_splitters/
def ingest_github_repo(github_url):
    owner, repo = github_url.rstrip("/").split("/")[-2:]

    es = get_elasticsearch_client()
    try:
        ensure_index(es, recreate_if_invalid=True)
    except Exception as exc:
        print(f"Error ensuring Elasticsearch index: {exc}")
        return

    # Delete existing chunks for this repository to avoid mixing stale data
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

    if not OPENAI_API_KEY:
        print("Warning: OPENAI_API_KEY not found. Skipping embeddings.")
        return

    embeddings_model = OpenAIEmbeddings(
        model="text-embedding-ada-002",
        api_key=OPENAI_API_KEY
    )

    files = get_repo_files(owner, repo)
    for file_path in files:
        content = get_file_content(owner, repo, file_path)
        chunks = []

        # Markdown
        if file_path.endswith(".md") and MarkdownHeaderTextSplitter is not None:
            headers_to_split_on = [("#", "Header 1"), ("##", "Header 2"), ("###", "Header 3")]
            splitter = MarkdownHeaderTextSplitter(headers_to_split_on)
            md_chunks = splitter.split_text(content)
            char_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
            chunks = char_splitter.split_documents(md_chunks)
        # JSON
        elif file_path.endswith(".json") and RecursiveJsonSplitter is not None:
            import json
            try:
                json_data = json.loads(content)
                splitter = RecursiveJsonSplitter(max_chunk_size=1000)
                chunks = splitter.create_documents(texts=[json_data])
            except Exception:
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
                ".vb": Language.VISUALBASIC6,
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
                splitter = RecursiveCharacterTextSplitter.from_language(language=language, chunk_size=1000, chunk_overlap=100)
            else:
                splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)

            from langchain.schema import Document
            doc = Document(page_content=content, metadata={"source": file_path})
            chunks = splitter.split_documents([doc])

        try:
            if not chunks:
                continue

            chunk_texts = [chunk.page_content for chunk in chunks]
            embeddings = embeddings_model.embed_documents(chunk_texts)

            for chunk, embedding in zip(chunks, embeddings):
                doc = {
                    "repo_owner": owner,
                    "repo_name": repo,
                    "file_path": file_path,
                    "content": chunk.page_content,
                    "metadata": chunk.metadata,
                    "embedding": embedding,
                    "chunk_id": generate_chunk_id(owner, repo, file_path, chunk.page_content),
                    "timestamp": int(time.time())
                }
                es.index(index=INDEX_NAME, id=doc["chunk_id"], body=doc)

            print(f"Successfully indexed {len(chunks)} chunks from {file_path}")
        except Exception as e:
            print(f"Error processing {file_path}: {str(e)}")
            continue

    try:
        es.indices.refresh(index=INDEX_NAME)
    except Exception as refresh_error:
        print(f"Warning: Failed to refresh index: {refresh_error}")

