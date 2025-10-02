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
from config import ES_HOST, ES_USER, ES_PASSWORD, GOOGLE_API_KEY
import json
import hashlib
import time
import random
import tempfile
import os
from io import StringIO
from typing import List, Dict, Any

# Mock embeddings for testing when Google Generative AI has compatibility issues
class MockGoogleGenerativeAIEmbeddings:
    """Mock embeddings class for testing when Google Generative AI has compatibility issues."""

    def __init__(self, model="models/embedding-001", google_api_key=None):
        self.model = model
        self.google_api_key = google_api_key

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Generate mock embeddings for testing."""
        return [[random.random() for _ in range(768)] for _ in texts]

    def embed_query(self, text: str) -> List[float]:
        """Generate mock embedding for a single query."""
        return [random.random() for _ in range(768)]

# Try to import Google Generative AI, fall back to mock if it fails
try:
    from langchain_google_genai import GoogleGenerativeAIEmbeddings
    print("✅ Using real Google Generative AI embeddings")
except Exception as e:
    print(f"⚠️  Google Generative AI not available ({e}), using mock embeddings for testing")
    GoogleGenerativeAIEmbeddings = MockGoogleGenerativeAIEmbeddings

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

        # Generate embedding for the query
        if not GOOGLE_API_KEY:
            raise ValueError("GOOGLE_API_KEY not found")

        embeddings_model = GoogleGenerativeAIEmbeddings(
            model="models/embedding-001",
            google_api_key=GOOGLE_API_KEY
        )

        query_embedding = embeddings_model.embed_query(query)

        # Build search query
        search_body = {
            "size": top_k,
            "query": {
                "bool": {
                    "should": [
                        {
                            "script_score": {
                                "query": {"match_all": {}},
                                "boost": 0.7,
                                "script": {
                                    "source": "cosineSimilarity(params.query_vector, 'embedding') + 1.0",
                                    "params": {"query_vector": query_embedding}
                                }
                            }
                        },
                        {
                            "multi_match": {
                                "query": query,
                                "fields": ["content", "file_path", "repo_name"],
                                "boost": 0.3
                            }
                        }
                    ]
                }
            }
        }

        # Add repository filter if specified
        if repo_filter:
            owner, repo = repo_filter.split("/")
            search_body["query"]["bool"]["filter"] = [
                {"term": {"repo_owner": owner}},
                {"term": {"repo_name": repo}}
            ]

        # Execute search
        response = es.search(index="repo_chunks", body=search_body)

        # Format results
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
    files = get_repo_files(owner, repo)
    for file_path in files:
        content = get_file_content(owner, repo, file_path)
        # Markdown
        if file_path.endswith(".md") and MarkdownHeaderTextSplitter is not None:
            headers_to_split_on = [("#", "Header 1"), ("##", "Header 2"), ("###", "Header 3")]
            splitter = MarkdownHeaderTextSplitter(headers_to_split_on)
            md_chunks = splitter.split_text(content)
            # Optionally further split large markdown chunks
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
                # fallback to text splitting if JSON is invalid
                # Create temporary file for TextLoader
                with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False, encoding='utf-8') as temp_file:
                    temp_file.write(content)
                    temp_file_path = temp_file.name

                    try:
                        loader = TextLoader(temp_file_path)
                        docs = loader.load()
                        splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
                        chunks = splitter.split_documents(docs)
                    finally:
                        # Clean up temporary file
                        os.unlink(temp_file_path)
        elif file_path.endswith(".json") and RecursiveJsonSplitter is None:
            # Create temporary file for TextLoader if JSON splitter not available
            with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False, encoding='utf-8') as temp_file:
                temp_file.write(content)
                temp_file_path = temp_file.name

                try:
                    loader = TextLoader(temp_file_path)
                    docs = loader.load()
                    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
                    chunks = splitter.split_documents(docs)
                finally:
                    # Clean up temporary file
                    os.unlink(temp_file_path)
        # Supported code/text types
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

            # Use splitter directly on content for text files to avoid encoding issues
            from langchain.schema import Document
            doc = Document(page_content=content, metadata={"source": file_path})
            chunks = splitter.split_documents([doc])
        # Generate embeddings and index in Elasticsearch
        try:
            # Initialize embeddings
            if not GOOGLE_API_KEY:
                print(f"Warning: GOOGLE_API_KEY not found. Skipping embeddings for {file_path}")
                continue

            embeddings_model = GoogleGenerativeAIEmbeddings(
                model="models/embedding-001",
                google_api_key=GOOGLE_API_KEY
            )

            # Generate embeddings for chunks
            chunk_texts = [chunk.page_content for chunk in chunks]
            embeddings = embeddings_model.embed_documents(chunk_texts)

            # Initialize Elasticsearch
            es = Elasticsearch(
                hosts=[ES_HOST],
                basic_auth=(ES_USER, ES_PASSWORD),
                verify_certs=False
            )

            # Index chunks in Elasticsearch
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
                es.index(index="repo_chunks", body=doc)

            print(f"Successfully indexed {len(chunks)} chunks from {file_path}")

        except Exception as e:
            print(f"Error processing {file_path}: {str(e)}")
            continue
