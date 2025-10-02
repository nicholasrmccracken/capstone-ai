import os
import requests

def _get_default_branch(owner, repo, headers):

    url = f"https://api.github.com/repos/{owner}/{repo}"
    resp = requests.get(url, headers=headers)
    resp.raise_for_status()  # Will raise an error if the repo doesn't exist
    return resp.json()["default_branch"]

def get_repo_files(owner, repo):
    # sample call to see expected output format of file tree
    # https://api.github.com/repos/elipaulman/GOVS/git/trees/main?recursive=1
    headers = {}
    token = os.getenv("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"

    try:
        branch = _get_default_branch(owner, repo, headers)
    except requests.exceptions.HTTPError:
        raise

    url = f"https://api.github.com/repos/{owner}/{repo}/git/trees/{branch}?recursive=1"
    resp = requests.get(url, headers=headers)
    resp.raise_for_status()
    tree = resp.json()["tree"]
    return [item["path"] for item in tree if item["type"] == "blob"]

def get_file_content(owner, repo, path):
    # sample call to see expected output format of file content
    # https://raw.githubusercontent.com/elipaulman/GOVS/main/README.md
    headers = {}
    token = os.getenv("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
        
    try:
        branch = _get_default_branch(owner, repo, headers)
    except requests.exceptions.HTTPError:
        raise
    
    url = f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}"
    # The raw content URL doesn't use the auth header.
    resp = requests.get(url)
    resp.raise_for_status()
    return resp.text
