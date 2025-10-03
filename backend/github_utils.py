import os
from github import Github
from config import GITHUB_TOKEN

def _get_repo(owner, repo):
    """Get repository object using PyGithub."""
    g = Github(GITHUB_TOKEN if GITHUB_TOKEN else None)
    return g.get_repo(f"{owner}/{repo}")

def get_repo_files(owner, repo):
    """
    Get all text/code file paths from a GitHub repository using PyGithub.

    Filters out binary files (images, videos, etc.) to avoid processing issues.
    PyGithub handles rate limiting automatically and is more reliable than raw requests.
    """
    repo_obj = _get_repo(owner, repo)

    # Use recursive=True to get all files (including in subdirectories)
    contents = repo_obj.get_contents("")
    files = []

    # File extensions to skip (binary/image/video files that aren't useful for code search)
    BINARY_EXTENSIONS = {
        # Images
        '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.ico', '.svg',
        '.tiff', '.tif', '.psd', '.ai', '.eps', '.indd',
        # Videos
        '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv', '.3gp',
        # Audio
        '.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', '.m4a',
        # Archives
        '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz',
        # Documents (complex binaries)
        '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx',
        # Other binaries
        '.exe', '.dll', '.so', '.dylib', '.app', '.deb', '.rpm',
        '.iso', '.dmg', '.pkg', '.appimage'
    }

    def _walk_contents(contents):
        for content in contents:
            if content.type == "file":
                file_path = content.path.lower()
                # Skip binary files
                if not any(file_path.endswith(ext) for ext in BINARY_EXTENSIONS):
                    files.append(content.path)
            elif content.type == "dir":
                # Skip common non-code directories
                skip_dirs = {'node_modules', '.git', '__pycache__', '.next', 'build', 'dist', '.venv', 'venv', 'env'}
                if content.name not in skip_dirs:
                    try:
                        dir_contents = repo_obj.get_contents(content.path)
                        _walk_contents(dir_contents)
                    except Exception:
                        # Skip directories we can't access (might be binary/symlinks)
                        pass

    _walk_contents(contents)
    return files

def get_file_content(owner, repo, path):
    """
    Get file content from GitHub using PyGithub.

    This method handles binary files and encoding automatically.
    """
    repo_obj = _get_repo(owner, repo)

    try:
        content_file = repo_obj.get_contents(path)
        # PyGithub returns content as base64 encoded bytes
        import base64
        decoded_content = base64.b64decode(content_file.content)
        # Assume text content and decode as UTF-8
        # This will work for code files; binary files would need different handling
        return decoded_content.decode('utf-8', errors='ignore')
    except UnicodeDecodeError:
        # If not decodable as text, return empty string
        # For code search, we typically only want text files
        return ""
    except Exception as e:
        raise ValueError(f"Could not fetch content for {owner}/{repo}/{path}: {str(e)}")
