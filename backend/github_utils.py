import requests

def get_repo_files(owner, repo, branch="main"):
    url = f"https://api.github.com/repos/{owner}/{repo}/git/trees/{branch}?recursive=1"
    resp = requests.get(url)
    resp.raise_for_status()
    tree = resp.json()["tree"]
    return [item["path"] for item in tree if item["type"] == "blob"]

def get_file_content(owner, repo, path, branch="main"):
    url = f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}"
    resp = requests.get(url)
    resp.raise_for_status()
    return resp.text