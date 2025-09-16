from github_utils import get_repo_files, get_file_content
from langchain.document_loaders import TextLoader
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
# from langchain.embeddings import OpenAIEmbeddings
# from elasticsearch import Elasticsearch

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
                loader = TextLoader.from_text(content, file_path)
                docs = loader.load()
                splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
                chunks = splitter.split_documents(docs)
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
            loader = TextLoader.from_text(content, file_path)
            docs = loader.load()
            chunks = splitter.split_documents(docs)
        # TODO: Generate embeddings and index in Elasticsearch
        # embeddings = OpenAIEmbeddings().embed_documents([chunk.page_content for chunk in chunks])
        # es = Elasticsearch(...)
        # for chunk, embedding in zip(chunks, embeddings):
        #     es.index(index="repo_chunks", document={...})