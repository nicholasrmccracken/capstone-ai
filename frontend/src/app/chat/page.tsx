"use client";
import { useMemo, useRef, useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface TreeStructure {
  [key: string]: TreeStructure | string;
}

interface Message {
  sender: string;
  text: string;
  sourceFiles: string[];
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

const getAllFilePaths = (
  structure: TreeStructure,
  parentPath: string[] = []
): string[] => {
  let paths: string[] = [];
  for (const [name, value] of Object.entries(structure)) {
    const currentPath = [...parentPath, name];
    const fullPath = currentPath.join("/");
    if (typeof value === "object" && value !== null) {
      // This is a directory, recurse
      paths = paths.concat(getAllFilePaths(value, currentPath));
    } else {
      // This is a file
      paths.push(fullPath);
    }
  }
  return paths;
};

export default function Chat() {
  const [url, setUrl] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "bot",
      text: "👋 Welcome to RepoRover! Please enter a GitHub repository URL to get started.\n\n💡 **Tip:** Use @filename.py to tag files for detailed explanations!",
      sourceFiles: [],
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
  const [allFilePaths, setAllFilePaths] = useState<string[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteOptions, setAutocompleteOptions] = useState<string[]>([]);
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);
  const [atPosition, setAtPosition] = useState<number>(-1);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const treeContainerRef = useRef<HTMLDivElement>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom when new messages are added
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [messages]);

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
        // Extract all file paths for autocomplete
        const filePaths = getAllFilePaths(data.tree_structure);
        console.log("Extracted file paths:", filePaths.length, "files");
        setAllFilePaths(filePaths);
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
      const trimmedUrl = url.trim();
      setRepoUrl(trimmedUrl);
      fetchDirectoryTree(trimmedUrl);

      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "✅ Thanks! That looks like a valid GitHub repository. Starting ingestion...",
          sourceFiles: [],
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

        if (data.status === "started") {
          setMessages((prev) => [
            ...prev,
            { sender: "bot", text: "✅ Repository ingestion complete. You can now ask questions about the repo.", sourceFiles: [] },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            { sender: "bot", text: `❌ ${data.message || "Error starting ingestion"}`, sourceFiles: [] },
          ]);
        }
      } catch (error) {
        setMessages((prev) => [
          ...prev,
          { sender: "bot", text: "❌ Error connecting to backend. Please try again later.", sourceFiles: [] },
        ]);
      }
    }
  };

  // Parse @file tags from input message
  const parseFileTags = (text: string): { cleanText: string, taggedFiles: string[] } => {
    const fileTagRegex = /@([^\s]+)/g;
    const taggedFiles: string[] = [];
    let match;
    while ((match = fileTagRegex.exec(text)) !== null) {
      taggedFiles.push(match[1]);
    }
    const cleanText = text.replace(fileTagRegex, "").trim();
    return { cleanText, taggedFiles };
  };

  // Handle input changes for autocomplete
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;

    console.log("Input changed:", value, "cursor at:", cursorPos);
    setInputMessage(value);

    // Check if we're typing after an @
    const atIndex = value.lastIndexOf('@', cursorPos - 1);
    console.log("At index:", atIndex, "allFilePaths length:", allFilePaths.length);

    if (atIndex !== -1 && cursorPos > atIndex) {
      const afterAt = value.substring(atIndex + 1, cursorPos);
      console.log("After @:", afterAt);
      if (!afterAt.includes(' ') && !afterAt.includes('@')) {
        // Filter matching file paths (including empty string for all files)
        const matches = allFilePaths.filter(path =>
          path.toLowerCase().includes(afterAt.toLowerCase())
        ).slice(0, 5);
        console.log("Autocomplete matches for '" + afterAt + "':", matches.length, "files");
        console.log("Matches:", matches);
        setAutocompleteOptions(matches);
        setAtPosition(atIndex);
        setAutocompleteIndex(0);
        setShowAutocomplete(matches.length > 0);
        console.log("Show autocomplete:", matches.length > 0);
      } else {
        console.log("Hiding autocomplete - space or @ found");
        setShowAutocomplete(false);
      }
    } else {
      console.log("Hiding autocomplete - no @ found");
      setShowAutocomplete(false);
    }
  };

  // Handle keyboard navigation in autocomplete
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showAutocomplete) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAutocompleteIndex(prev => (prev + 1) % autocompleteOptions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAutocompleteIndex(prev => prev === 0 ? autocompleteOptions.length - 1 : prev - 1);
    } else if (e.key === 'Enter' && showAutocomplete) {
      e.preventDefault();
      const selectedPath = autocompleteOptions[autocompleteIndex];
      const beforeAt = inputMessage.substring(0, atPosition);
      const afterAt = inputMessage.substring(atPosition + 1);
      const atEnd = afterAt.indexOf(' ') !== -1 ? afterAt.indexOf(' ') : afterAt.length;
      const afterSelection = afterAt.substring(atEnd);
      const newInput = beforeAt + '@' + selectedPath + afterSelection;
      setInputMessage(newInput);
      setShowAutocomplete(false);
      // Set cursor after the completed path
      setTimeout(() => {
        if (inputRef.current) {
          const newPos = beforeAt.length + selectedPath.length + 1;
          inputRef.current.setSelectionRange(newPos, newPos);
        }
      }, 0);
    } else if (e.key === 'Escape') {
      setShowAutocomplete(false);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputMessage.trim() || !treeStructure || !repoUrl) return;

    const { cleanText, taggedFiles } = parseFileTags(inputMessage);

    // If no question text and no tagged files, do nothing
    if (!cleanText.trim() && taggedFiles.length === 0) return;

    const currentMessage = inputMessage; // Store current message before clearing
    setInputMessage(""); // Clear input immediately
    setShowAutocomplete(false);

    setMessages((prev) => [...prev, { sender: "user", text: currentMessage, sourceFiles: [] }]);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
      const payload: any = {
        query: cleanText || "Explain these files",
        github_url: repoUrl
      };

      // Add tagged files if any
      if (taggedFiles.length > 0) {
        payload.tagged_files = taggedFiles;
      }

      const response = await fetch(`${backendUrl}/api/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      console.log("LLM Response:", data.response);
      console.log("Source files:", data.source_files);

      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: data.response || `⚠️ Error: ${data.message || "Failed to query."}`,
          sourceFiles: data.source_files || [],
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "❌ Error connecting to backend. Please try again later.",
          sourceFiles: [],
        },
      ]);
    }
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

      if (!response.ok) {
        if (response.status === 404) {
          console.log(`File not found in current repository: ${filePath}`);
          setMessages((prev) => [
            ...prev,
            { sender: "bot", text: `❌ File "${filePath}" not found in current repository. It may be from a different repository or the path may have changed.`, sourceFiles: [] },
          ]);
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setFileContent(data.content);
      setViewMode("file");
      treeContainerRef.current?.scrollTo(0, 0);
    } catch (error) {
      console.error("Error fetching file content:", error);
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: `❌ Failed to fetch file content for "${filePath}": ${error}. This file may not exist in the current repository.`, sourceFiles: [] },
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

  // Handle clearing all repositories from Elasticsearch
  const handleClearRepositories = async () => {
    setIsClearing(true);
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
      const response = await fetch(`${backendUrl}/api/clear_repositories`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (data.status === "success") {
        setMessages((prev) => [
          ...prev,
          {
            sender: "bot",
            text: `✅ ${data.message}`,
            sourceFiles: [],
          },
        ]);
        // Clear the current repository state
        setTreeStructure(null);
        setRepoUrl("");
        setUrl("");
        setCurrentPath([]);
        setViewMode("tree");
        setFileContent(null);
        setSelectedFile(null);
        setSelectedItems([]);
        setExpandedNodes(new Set());
        setAllFilePaths([]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            sender: "bot",
            text: `❌ ${data.message}`,
            sourceFiles: [],
          },
        ]);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "❌ Error connecting to backend. Please try again later.",
          sourceFiles: [],
        },
      ]);
    } finally {
      setIsClearing(false);
      setShowClearConfirm(false);
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
                  <span
                    onClick={(e) => handleFileClick(name, parentPath, e)}
                    className={`hover:underline ${selectedItems.includes(itemPath) || selectedFile === itemPath ? "bg-yellow-600 text-white px-1 rounded" : ""}`}
                    data-file-path={itemPath}
                  >
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

  // Handle clicking on source file links
  const handleSourceFileClick = (filePath: string) => {
    console.log("Source file clicked:", filePath);
    console.log("Available file paths:", allFilePaths.length, "files");
    console.log("Tree structure exists:", !!treeStructure);
    console.log("Repo details:", repoDetails);

    // Try to open the file - don't restrict to allFilePaths since source files might be from different contexts
    if (repoDetails.owner && repoDetails.repo && repoDetails.defaultBranch) {
      setSelectedFile(filePath);
      setSelectedItems([filePath]);

      // Try to fetch and display the file content directly
      fetchFileContent(filePath);

      // If we have a tree structure, try to expand parent directories and scroll to the file
      if (treeStructure && allFilePaths.length > 0) {
        // Try to expand parent directories to make the file visible
        const pathParts = filePath.split('/');
        const parentPaths: string[] = [];
        for (let i = 1; i < pathParts.length; i++) {
          parentPaths.push(pathParts.slice(0, i).join('/'));
        }

        // Expand all parent directories
        setExpandedNodes(prev => {
          const newSet = new Set(prev);
          parentPaths.forEach(path => newSet.add(path));
          return newSet;
        });

        // Scroll to make the file visible in the tree (only if it exists in current repo)
        setTimeout(() => {
          const fileElement = document.querySelector(`[data-file-path="${filePath}"]`);
          if (fileElement) {
            fileElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            console.log("Successfully scrolled to file:", filePath);
          } else {
            console.log("File not found in current repository tree:", filePath);
            console.log("This is normal - source files may be from different repositories");
          }
        }, 100);
      } else {
        console.log("No tree structure available or no file paths loaded");
      }
    } else {
      console.log("Repository details not available for file opening");
    }
  };

  // Render message with @file highlighting
  const renderMessageWithHighlights = (text: string, isUser: boolean) => {
    if (isUser) {
      // For user messages, highlight @file tags
      const parts = text.split(/(@[^\s]+)/g);
      return parts.map((part, index) => {
        if (part.startsWith('@') && part.length > 1) {
          return (
            <span key={index} className="bg-blue-500 text-white px-1 rounded font-mono text-sm">
              {part}
            </span>
          );
        }
        return part;
      });
    }
    // For bot messages, just render as markdown
    return <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>;
  };

  // Render source files for bot messages
  const renderSourceFiles = (sourceFiles: string[]) => {
    if (!sourceFiles || sourceFiles.length === 0) return null;

    // Deduplicate source files while preserving order
    const uniqueFiles = sourceFiles.filter((file, index, arr) => arr.indexOf(file) === index);

    return (
      <div className="mt-2 pt-2 border-t border-gray-600">
        <div className="text-xs text-gray-400 mb-1">📄 Sources:</div>
        <div className="flex flex-wrap gap-1">
          {uniqueFiles.map((filePath, index) => (
            <button
              key={`${filePath}-${index}`}
              onClick={() => handleSourceFileClick(filePath)}
              className="text-xs bg-gray-600 hover:bg-gray-500 text-gray-200 px-2 py-1 rounded font-mono transition-colors"
              title={`Click to open ${filePath}`}
            >
              {filePath.split('/').pop()}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <main className="flex flex-col items-center bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white p-4 gap-4" style={{ height: '100vh' }}>
      {/* Chat UI */}
      <h2 className="text-4xl font-bold text-blue-400 drop-shadow-md">
        RepoRover Chat
      </h2>
      <div className="flex w-full max-w-screen-2xl gap-3" style={{ height: 'calc(100vh - 120px)' }}>
        <div className="w-1/2 bg-gray-900/70 border border-gray-700 p-6 rounded-xl shadow-lg flex flex-col" style={{ height: '100%' }}>
          <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
            <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Enter a GitHub repository URL"
              className="flex-1 p-3 border border-gray-600 bg-gray-800 text-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            <button type="submit" className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all">Send</button>
          </form>

          {/* Clear Repositories Button */}
          <div className="mb-4">
            <button
              onClick={() => setShowClearConfirm(true)}
              className="w-full px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
              title="Clear all repositories from Elasticsearch"
            >
              Clear Repositories
            </button>
          </div>

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
        <div className="flex flex-col w-1/2" style={{ height: '100%' }}>
          <div ref={chatMessagesRef} className="flex-1 bg-gray-900/70 border border-gray-700 p-6 rounded-xl shadow-lg overflow-y-auto">
            {messages.map((msg, index) => (
              <div
              key={index}
              className={`markdown-content mb-3 p-3 rounded-lg max-w-[95%] mx-auto ${
                msg.sender === "bot"
                ? "bg-gray-700 text-gray-200"
                : "bg-blue-600 text-white"
                }`}
                >
                {renderMessageWithHighlights(msg.text, msg.sender === "user")}
                {msg.sender === "bot" && renderSourceFiles(msg.sourceFiles || [])}
              </div>
            ))}
          </div>
          <div className="relative">
            <form onSubmit={handleChatSubmit} className="flex gap-2 mt-4">
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={handleInputChange}
                onKeyDown={handleInputKeyDown}
                placeholder={repoUrl ? "Ask a question about the repo or use @filename..." : "First enter a repo URL above"}
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
            {/* Autocomplete Dropdown */}
            {showAutocomplete && autocompleteOptions.length > 0 && (() => {
              console.log("Rendering dropdown:", showAutocomplete, autocompleteOptions.length);
              return (
                <div
                  className="absolute bottom-full left-0 right-0 bg-gray-800 border border-gray-600 rounded-lg shadow-lg mb-1 max-h-32 overflow-y-auto"
                  style={{ zIndex: 99999 }}
                >
                  {autocompleteOptions.map((option, index) => (
                    <div
                      key={option}
                      className={`p-2 cursor-pointer border-l-2 ${
                        index === autocompleteIndex
                          ? "bg-blue-600 text-white border-blue-400"
                          : "text-gray-300 hover:bg-gray-700 border-transparent"
                      }`}
                      onClick={() => {
                        const selectedPath = option;
                        const beforeAt = inputMessage.substring(0, atPosition);
                        const afterAt = inputMessage.substring(atPosition + 1);
                        const atEnd = afterAt.indexOf(' ') !== -1 ? afterAt.indexOf(' ') : afterAt.length;
                        const afterSelection = afterAt.substring(atEnd);
                        const newInput = beforeAt + '@' + selectedPath + afterSelection;
                        setInputMessage(newInput);
                        setShowAutocomplete(false);
                        setTimeout(() => {
                          if (inputRef.current) {
                            const newPos = beforeAt.length + selectedPath.length + 1;
                            inputRef.current.setSelectionRange(newPos, newPos);
                          }
                        }, 0);
                      }}
                    >
                      <span className="font-mono text-sm">{option}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Confirmation Dialog for Clearing Repositories */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-600 rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-xl font-bold text-white mb-4 text-center">Clear All Repositories?</h3>
            <p className="text-gray-300 mb-6">
              This will permanently delete all ingested repositories and their data from Elasticsearch.
              This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
                disabled={isClearing}
              >
                Cancel
              </button>
              <button
                onClick={handleClearRepositories}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors flex items-center gap-2"
                disabled={isClearing}
              >
                {isClearing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Clearing...
                  </>
                ) : (
                  <>
                    Clear All
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
