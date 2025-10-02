"use client";
import { useState } from "react";

interface TreeStructure {
  [key: string]: TreeStructure | string;
}

export default function Chat() {
  const [url, setUrl] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [messages, setMessages] = useState([
    {
      sender: "bot",
      text: "👋 Welcome to RepoRover! Please enter a GitHub repository URL to get started.",
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [treeStructure, setTreeStructure] = useState<TreeStructure | null>(null);
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"tree" | "file">("tree");
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [repoDetails, setRepoDetails] = useState({ owner: "", repo: "", defaultBranch: "" });
  const [isLoadingTree, setIsLoadingTree] = useState(false);
  const [treeError, setTreeError] = useState<string | null>(null);

  // Regex to validate GitHub repo URLs
  const githubRegex =
    /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/;

  const fetchDirectoryTree = async (repoUrl: string) => {
    setIsLoadingTree(true);
    setTreeError(null);
    setTreeStructure(null);
    setCurrentPath([]);
    setViewMode("tree");
    setFileContent(null);
    setSelectedFile(null);
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
      const response = await fetch(`${backendUrl}/api/get_tree`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ github_url: repoUrl }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch directory tree.");
      }

      const data = await response.json();
      if (data.status === "success") {
        setTreeStructure(data.tree_structure);
        setRepoDetails({
          owner: data.owner,
          repo: data.repo,
          defaultBranch: data.default_branch || "main",
        });
      } else {
        throw new Error(data.message || "An unknown error occurred.");
      }
    } catch (error: any) {
      setTreeError(`Failed to load directory tree: ${error.message}`);
    } finally {
      setIsLoadingTree(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setMessages((prev) => [...prev, { sender: "user", text: url }]);

    if (githubRegex.test(url)) {
      const trimmedUrl = url.trim();
      setRepoUrl(trimmedUrl);
      fetchDirectoryTree(trimmedUrl);

      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "✅ Thanks! That looks like a valid GitHub repository. Processing...",
        },
      ]);
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
        const response = await fetch(`${backendUrl}/api/ingest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ github_url: trimmedUrl }),
        });
        const data = await response.json();
        setMessages((prev) => [
          ...prev,
          {
            sender: "bot",
            text:
              data.status === "started"
                ? "🚀 Ingestion started! Please wait while we process the repository."
                : `⚠️ Error: ${data.message || "Failed to start ingestion."}`,
          },
        ]);
      } catch (error) {
        setMessages((prev) => [
          ...prev,
          {
            sender: "bot",
            text: "❌ Error connecting to backend. Please try again later.",
          },
        ]);
      }
    } else {
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "❌ That doesn’t look like a valid GitHub repository. Please try again.",
        },
      ]);
    }

    setUrl("");
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputMessage.trim() || !treeStructure || !repoUrl) return;

    setMessages((prev) => [...prev, { sender: "user", text: inputMessage }]);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
      const response = await fetch(`${backendUrl}/api/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: inputMessage, github_url: repoUrl }),
      });
      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: data.response || `⚠️ Error: ${data.message || "Failed to query."}`,
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "❌ Error connecting to backend. Please try again later.",
        },
      ]);
    }
    setInputMessage("");
  };

  const getCurrentStructure = (): TreeStructure => {
    let current = treeStructure;
    for (const part of currentPath) {
      current = current?.[part] as TreeStructure;
    }
    return current || {};
  };

  const handleFolderClick = (name: string) => {
    setCurrentPath([...currentPath, name]);
  };

  const handleBackClick = () => {
    if (viewMode === "file") {
      setViewMode("tree");
      setFileContent(null);
    } else if (currentPath.length > 0) {
      setCurrentPath(currentPath.slice(0, -1));
    }
  };

  const fetchFileContent = async (filePath: string) => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
      const response = await fetch(`${backendUrl}/api/get_file_content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: repoDetails.owner,
          repo: repoDetails.repo,
          branch: repoDetails.defaultBranch,
          path: filePath,
        }),
      });
      if (!response.ok) throw new Error("Failed to fetch file content");
      const data = await response.json();
      setFileContent(data.content);
      setViewMode("file");
    } catch (error) {
      console.error(error);
      // Optionally add error message to UI
    }
  };

  const handleFileClick = (name: string) => {
    const filePath = [...currentPath, name].join("/");
    setSelectedFile(filePath);
    fetchFileContent(filePath);
  };

  const TreeNode: React.FC<{ structure: TreeStructure; level?: number }> = ({ structure, level = 0 }) => {
    const entries = Object.entries(structure).sort(([a], [b]) => a.localeCompare(b));
    return (
      <>
        {entries.map(([name, value], index) => {
          const isLast = index === entries.length - 1;
          const branch = isLast ? '└── ' : '├── ';
          const isDir = typeof value === "object";
          return (
            <div key={name} style={{ paddingLeft: `${level * 20}px` }} className="cursor-pointer">
              {branch}
              {isDir ? (
                <span onClick={() => handleFolderClick(name)} className="text-blue-400 hover:underline">
                  {name}/
                </span>
              ) : (
                <span
                  onClick={() => handleFileClick(name)}
                  className={`hover:underline ${selectedFile === [...currentPath, name].join("/") ? "bg-yellow-600 text-white px-1 rounded" : ""}`}
                >
                  {name}
                </span>
              )}
            </div>
          );
        })}
      </>
    );
  };

  const renderFileContentWithLines = () => {
    if (!fileContent) return null;
    const lines = fileContent.split('\n');
    return (
      <pre className="text-sm text-gray-300 font-mono whitespace-pre overflow-auto">
        {lines.map((line, index) => (
          <div key={index} className="flex">
            <span className="inline-block w-8 text-right pr-2 select-none text-gray-500">{index + 1}</span>
            <span>{line}</span>
          </div>
        ))}
      </pre>
    );
  };
const getCurrentDisplayPath = () => {
    if (viewMode === "tree") {
      return `${repoDetails.repo}${currentPath.length > 0 ? ` / ${currentPath.join('/')}` : ''}`;
    } else {
      return `${repoDetails.repo} / ${selectedFile}`;
    }
  };

  return (
    <main className="flex flex-col items-center h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white p-4 gap-4">
      <h2 className="text-4xl font-bold text-blue-400 drop-shadow-md">
        RepoRover Chat
      </h2>

      {/* Main Content Area */}
      <div className="flex w-full max-w-7xl flex-1 gap-4 overflow-hidden">
        {/* Left Panel: Input Form + Repository Structure */}
        <div className="w-1/2 bg-gray-900/70 border border-gray-700 p-6 rounded-xl shadow-lg flex flex-col">
          <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter a GitHub repository URL"
              className="flex-1 p-3 border border-gray-600 bg-gray-800 text-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all"
            >
              Send
            </button>
          </form>
          <h3 className="text-xl font-bold mb-2 text-gray-300">Repository Structure</h3>
          {treeStructure && (
            <p className="mb-2 text-sm text-gray-400 truncate">
              {getCurrentDisplayPath()}
            </p>
          )}
          <div className="flex-1 overflow-auto bg-gray-900 p-4 rounded-md">
            {isLoadingTree && <p className="text-gray-400">Loading tree...</p>}
            {treeError && <p className="text-red-400">{treeError}</p>}
            {treeStructure && (
              <>
                {(currentPath.length > 0 || viewMode === "file") && (
                  <button
                    onClick={handleBackClick}
                    className="mb-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
                  >
                    Back
                  </button>
                )}
                {viewMode === "tree" ? (
                  <div className="text-sm text-gray-300 font-mono">
                    <TreeNode structure={getCurrentStructure()} level={0} />
                  </div>
                ) : (
                  renderFileContentWithLines()
                )}
              </>
            )}
            {!isLoadingTree && !treeError && !treeStructure && (
              <p className="text-gray-500">Enter a repository URL to see its structure here.</p>
            )}
          </div>
        </div>

        {/* Right Panel: Chat Window */}
        <div className="flex flex-col w-1/2">
          <div className="flex-1 bg-gray-900/70 border border-gray-700 p-6 rounded-xl shadow-lg overflow-y-auto">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`mb-3 p-3 rounded-lg max-w-[85%] ${
                  msg.sender === "bot"
                    ? "bg-gray-700 text-gray-200 self-start"
                    : "bg-blue-600 text-white self-end"
                }`}
              >
                {msg.text}
              </div>
            ))}
          </div>
          <form onSubmit={handleChatSubmit} className="flex gap-2 mt-4">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={repoUrl ? "Ask a question about the repo..." : "First enter a repo URL above"}
              className="flex-1 p-3 border border-gray-600 bg-gray-800 text-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={!repoUrl}
            />
            <button
              type="submit"
              className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all"
              disabled={!repoUrl}
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}