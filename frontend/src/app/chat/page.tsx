"use client";
import { useMemo, useRef, useState } from "react";

interface TreeStructure {
  [key: string]: TreeStructure | string;
}

const getAllDirectoryPaths = (
  structure: TreeStructure,
  parentPath: string[] = []
): string[] => {
  let paths: string[] = [];
  for (const [name, value] of Object.entries(structure)) {
    if (typeof value === "object" && value !== null) {
      const currentPath = [...parentPath, name];
      paths.push(currentPath.join("/"));
      paths = paths.concat(getAllDirectoryPaths(value, currentPath));
    }
  }
  return paths;
};

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
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [repoDetails, setRepoDetails] = useState({ owner: "", repo: "", defaultBranch: "" });
  const [isLoadingTree, setIsLoadingTree] = useState(false);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const treeContainerRef = useRef<HTMLDivElement>(null);

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
    setSelectedItems([]);
    setExpandedNodes(new Set());
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

      if (githubRegex.test(url)) {
        setMessages((prev) => [
          ...prev,
          { sender: "bot", text: "✅ Processing repository ingestion..." },
        ]);

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
        const response = await fetch(`${backendUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ github_url: trimmedUrl }),
        });
        const data = await response.json();

        if (data.status === "success") {
          let answerText = data.answer;
          if (data.chunks_used > 0) {
            answerText += `\n\n📊 Used ${data.chunks_used} code chunks from repositories: ${data.repos.join(", ")}`;
          }
          setMessages((prev) => [
            ...prev,
            { sender: "bot", text: answerText },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            { sender: "bot", text: `❌ ${data.message || "Error processing question"}` },
          ]);
        }
      } catch (error) {
        setMessages((prev) => [
          ...prev,
          { sender: "bot", text: "❌ Error connecting to backend. Please try again later." },
        ]);
      }
    }

    setIsLoading(false);
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

  const handleFolderClick = (name: string, currentParentPath: string[], e: React.MouseEvent) => {
    const itemPath = [...currentParentPath, name].join("/");
    if (e.metaKey) {
      setSelectedItems((prev) =>
        prev.includes(itemPath) ? prev.filter((item) => item !== itemPath) : [...prev, itemPath]
      );
    } else if (e.detail === 2) {
      setCurrentPath([...currentParentPath, name]);
    } else if (e.detail === 1) {
      setExpandedNodes((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(itemPath)) {
          newSet.delete(itemPath);
        } else {
          newSet.add(itemPath);
        }
        return newSet;
      });
    }
  };

  const handleBackClick = () => {
    if (viewMode === "file") {
      setViewMode("tree");
      setFileContent(null);
      setSelectedFile(null);
    } else if (currentPath.length > 0) {
      setCurrentPath(currentPath.slice(0, -1));
      setSelectedFile(null);
      setSelectedItems([]);
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
      treeContainerRef.current?.scrollTo(0, 0);
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: `❌ Failed to fetch file content: ${error}` },
      ]);
    }
  };

  const handleFileClick = (name: string, parentPath: string[], e: React.MouseEvent) => {
    const filePath = [...parentPath, name].join("/");
    if (e.metaKey) {
      setSelectedItems((prev) =>
        prev.includes(filePath) ? prev.filter((item) => item !== filePath) : [...prev, filePath]
      );
    } else {
      setSelectedItems([filePath]);
    setSelectedFile(filePath);
    fetchFileContent(filePath);
    }
  };

  // Toggle between expanding and collapsing all nodes
  const handleToggleExpandAll = () => {
    if (!treeStructure) return;
    const allPaths = getAllDirectoryPaths(getCurrentStructure(), currentPath);
    // If not all nodes are expanded, expand them all. Otherwise, collapse them.
    if (expandedNodes.size < allPaths.length) {
      setExpandedNodes(new Set(allPaths));
    } else {
      setExpandedNodes(new Set());
    }
  };

  const TreeNode = ({ structure, parentPath = [], prefix = "" }: {
    structure: TreeStructure;
    parentPath?: string[];
    prefix?: string;
  }) => {
    const entries = Object.entries(structure);
    return (
      <>
        {entries.map(([name, value], index) => {
          const isLast = index === entries.length - 1;
          const connector = isLast ? '└─ ' : '├─ ';
          const isDir = typeof value === "object" && value !== null;
          const itemPath = [...parentPath, name].join("/");
          const isExpanded = expandedNodes.has(itemPath);

          return (
            <div key={name} className="cursor-pointer tree-node" style={{ marginBottom: '0.1rem' }}>
              <div className="flex items-center">
                <div className="flex font-mono whitespace-pre ascii-connector">
                  {prefix.match(/.{1,3}/g)?.map((segment, i) => (
                    <span key={i}>{segment}</span>
                  ))}
                  <span>{connector}</span>
                </div>
              {isDir ? (
                  <span onClick={(e) => handleFolderClick(name, parentPath, e)}
                    className={`hover:underline ${selectedItems.includes(itemPath) ? "bg-blue-600 text-blue-200 px-1 rounded" : "text-blue-400"}`}>
                    {name}/ {isExpanded ? '[-]' : '[+]'}
                </span>
              ) : (
                  <span onClick={(e) => handleFileClick(name, parentPath, e)}
                    className={`hover:underline ${selectedItems.includes(itemPath) || selectedFile === itemPath ? "bg-yellow-600 text-white px-1 rounded" : ""}`}>
                  {name}
                </span>
                )}
              </div>
              {isDir && isExpanded && (
                <TreeNode
                  structure={value as TreeStructure}
                  parentPath={[...parentPath, name]}
                  prefix={prefix + (isLast ? '   ' : '├  ')}
                />
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

  const renderTree = () => {
    const rootName = currentPath.length === 0 ? repoDetails.repo : currentPath[currentPath.length - 1];
    return (
      <div className="text-sm text-gray-300 font-mono">
        <div className="mb-1">
          <span>{rootName}</span>
        </div>
        <TreeNode structure={getCurrentStructure()} parentPath={currentPath} />
      </div>
    );
  };
  
  // Determine whether all nodes are expanded to determine the button's symbol
  const { allDirectoryPaths, isFullyExpanded } = useMemo(() => {
    if (!treeStructure) return { allDirectoryPaths: [], isFullyExpanded: false };
    const allPaths = getAllDirectoryPaths(getCurrentStructure(), currentPath);
    const fullyExpanded = allPaths.length > 0 && expandedNodes.size === allPaths.length;
    return { allDirectoryPaths: allPaths, isFullyExpanded: fullyExpanded };
  }, [treeStructure, currentPath, expandedNodes]);

  return (
    <main className="flex flex-col items-center h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white p-4 gap-4">
      <h2 className="text-4xl font-bold text-blue-400 drop-shadow-md">
        RepoRover Chat
      </h2>
      <div className="flex w-full max-w-7xl flex-1 gap-4 overflow-hidden">
        <div className="w-1/2 bg-gray-900/70 border border-gray-700 p-6 rounded-xl shadow-lg flex flex-col">
          <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
            <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Enter a GitHub repository URL"
              className="flex-1 p-3 border border-gray-600 bg-gray-800 text-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            <button type="submit" className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all">Send</button>
          </form>

          {/* --- MODIFIED: Heading and new toggle button are on the same line --- */}
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-xl font-bold text-gray-300">Repository Structure</h3>
            {treeStructure && viewMode === 'tree' && allDirectoryPaths.length > 0 && (
              <button
                onClick={handleToggleExpandAll}
                className="font-mono text-lg text-gray-400 hover:text-white px-2"
                title="Toggle Expand/Collapse All"
              >
                {isFullyExpanded ? '[-]' : '[+]'}
              </button>
          )}
          </div>

          <div ref={treeContainerRef} className="flex-1 overflow-auto bg-gray-900 p-4 rounded-md">
            {isLoadingTree && <p className="text-gray-400">Loading tree...</p>}
            {treeError && <p className="text-red-400">{treeError}</p>}
            {treeStructure && (
              <>
                {(currentPath.length > 0 || viewMode === "file") && (
                  <div className="mb-4">
                  <button
                    onClick={handleBackClick}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
                  >
                    Back
                  </button>
                  </div>
                )}
                {viewMode === 'tree' ? renderTree() : renderFileContentWithLines()}
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