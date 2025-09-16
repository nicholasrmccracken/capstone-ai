import requests

def get_repo_files(owner, repo, branch="main"):
    # sample call to see expected output format of file tree
    # https://api.github.com/repos/elipaulman/GOVS/git/trees/main?recursive=1
    url = f"https://api.github.com/repos/{owner}/{repo}/git/trees/{branch}?recursive=1"
    resp = requests.get(url)
    resp.raise_for_status()
    tree = resp.json()["tree"]
    return [item["path"] for item in tree if item["type"] == "blob"]

def get_file_content(owner, repo, path, branch="main"):
    # sample call to see expected output format of file content
    # https://raw.githubusercontent.com/elipaulman/GOVS/main/README.md
    url = f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}"
    resp = requests.get(url)
    resp.raise_for_status()
    return resp.text