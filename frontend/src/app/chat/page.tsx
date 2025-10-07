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

interface Tab {
  id: number;
  name: string;
  color: string;
  filePath: string | null;
  fileContent: string | null;
}

interface TreeNodeProps {
  structure: TreeStructure;
  parentPath?: string[];
  prefix?: string;
  expandedNodes: Set<string>;
  selectedItems: string[];
  fileColors: Map<string, string>;
  onFolderClick: (name: string, currentParentPath: string[], e: React.MouseEvent) => void;
  onFileClick: (name: string, parentPath: string[], e: React.MouseEvent) => void;
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
  const [treeCurrentPath, setTreeCurrentPath] = useState<string[]>([]);
  const [treeSelectedItems, setTreeSelectedItems] = useState<string[]>([]);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<number>(0);
  const [nextTabId, setNextTabId] = useState(1);
  const [fileColors, setFileColors] = useState<Map<string, string>>(new Map());

  const activeTab = useMemo(() => tabs.find((t) => t.id === activeTabId), [tabs, activeTabId]);

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
    if (!treeStructure) return {};

    let current = treeStructure;
    for (const part of treeCurrentPath) {
      current = current?.[part] as TreeStructure;
    }
    return current || {};
  };

  const handleFolderClick = (name: string, currentParentPath: string[], e: React.MouseEvent) => {
    const itemPath = [...currentParentPath, name].join("/");
    
    if (e.metaKey) {
      const newSelectedItems = treeSelectedItems.includes(itemPath)
        ? treeSelectedItems.filter((item) => item !== itemPath)
        : [...treeSelectedItems, itemPath];
      setTreeSelectedItems(newSelectedItems);
      return; // Stop further processing
    }
  
    // Handle double-click to enter directory
    if (e.detail === 2) {
      setTreeCurrentPath([...currentParentPath, name]);
    } 
    // Handle single-click to expand/collapse
    else if (e.detail === 1) {
      const newExpandedNodes = new Set(expandedNodes);
      if (newExpandedNodes.has(itemPath)) {
        newExpandedNodes.delete(itemPath);
      } else {
        newExpandedNodes.add(itemPath);
      }
      setExpandedNodes(newExpandedNodes);
    }
  };

  const handleTreeBackClick = () => {
    if (treeCurrentPath.length > 0) {
      setTreeCurrentPath(treeCurrentPath.slice(0, -1));
    }
  };

  const fetchFileContent = async (expectedPath: string, tabId: number) => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
      const response = await fetch(`${backendUrl}/api/get_file_content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: repoDetails.owner,
          repo: repoDetails.repo,
          branch: repoDetails.defaultBranch,
          path: expectedPath,
        }),
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.log(`File not found in current repository: ${expectedPath}`);
          setMessages((prev) => [
            ...prev,
            { sender: "bot", text: `❌ File "${expectedPath}" not found in current repository. It may be from a different repository or the path may have changed.`, sourceFiles: [] },
          ]);
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setTabs((prevTabs) =>
        prevTabs.map((t) =>
          t.id === tabId && t.filePath === expectedPath ? { ...t, fileContent: data.content } : t
        )
      );
    } catch (error: any) {
      console.error("Error fetching file content:", error);
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: `❌ Failed to fetch file content for "${expectedPath}": ${error.message}. This file may not exist in the current repository.`, sourceFiles: [] },
      ]);
    }
  };

  const handleFileClick = (name: string, parentPath: string[], e: React.MouseEvent) => {
    const filePath = [...parentPath, name].join("/");
  
    if (e.metaKey) {
      const newSelectedItems = treeSelectedItems.includes(filePath)
        ? treeSelectedItems.filter((item) => item !== filePath)
        : [...treeSelectedItems, filePath];
      setTreeSelectedItems(newSelectedItems);
      return; // Stop further processing
    }
    // Single click opens in base pinned tab
    if (e.detail === 1) {
      if (tabs.length === 0 || !activeTab) {
        addFileTab(filePath);
      } else {
        handleOpenFileInTab(activeTabId, filePath);
      }
    }
  };

  const addFileTab = (filePath: string) => {
    const name = filePath.split('/').pop() || "File";
    const colors = ["green", "yellow", "pink", "indigo"];
    const color = colors[(nextTabId - 1) % colors.length];
    const newTab: Tab = {
      id: nextTabId,
      name,
      color,
      filePath,
      fileContent: "Loading...",
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(nextTabId);
    setNextTabId(nextTabId + 1);
    fetchFileContent(filePath, newTab.id);
    if (!fileColors.has(filePath)) {
      setFileColors((prev) => new Map(prev).set(filePath, color));
    }
  };

  const handleOpenFileInTab = (tabId: number, filePath: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return;
    const oldPath = tab.filePath;
    const name = filePath.split('/').pop() || "File";
    let color = tab.color;
    if (tab.color === "gray") {
      const colors = ["green", "yellow", "pink", "indigo"];
      color = colors[(tabs.length) % colors.length];
    }
    setTabs(
      tabs.map((t) =>
        t.id === tabId ? { ...t, name, color, filePath, fileContent: "Loading..." } : t
      )
    );
    fetchFileContent(filePath, tabId);
    if (oldPath && oldPath !== filePath) {
      const remainingOld = tabs.filter(
        (t) => t.id !== tabId && t.filePath === oldPath
      ).length;
      if (remainingOld === 0) {
        setFileColors((prev) => {
          const newM = new Map(prev);
          newM.delete(oldPath);
          return newM;
        });
      }
    }
    const remainingNew = tabs.filter(
      (t) => t.id !== tabId && t.filePath === filePath
    ).length;
    if (remainingNew === 0 && !fileColors.has(filePath)) {
      setFileColors((prev) => new Map(prev).set(filePath, color));
    }
  };

  const addNewBlankTab = () => {
    const newId = nextTabId;
    const color = "gray";
    const newTab: Tab = {
      id: newId,
      name: "Untitled",
      color,
      filePath: null,
      fileContent: null,
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newId);
    setNextTabId(newId + 1);
  };

  const closeTab = (id: number) => {
    const closingTab = tabs.find((t) => t.id === id);
    const newTabs = tabs.filter((t) => t.id !== id);
    setTabs(newTabs);
    if (closingTab?.filePath) {
      const remaining = newTabs.filter(
        (t) => t.filePath === closingTab.filePath
      ).length;
      if (remaining === 0) {
        setFileColors((prev) => {
          const newM = new Map(prev);
          newM.delete(closingTab.filePath!);
          return newM;
        });
      }
    }
    if (activeTabId === id) {
      setActiveTabId(newTabs.length > 0 ? newTabs[0].id : 0);
    }
  };

  const handleDragStart = (e: React.DragEvent, draggedId: number) => {
    e.dataTransfer.setData("text/plain", draggedId.toString());
    setActiveTabId(draggedId);
  };
  
  const handleDragOver = (e: React.DragEvent, overId: number) => {
    e.preventDefault();
    const draggedId = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (draggedId === overId) return;
    setTabs((prevTabs) => {
      const newTabs = [...prevTabs];
      const draggedIndex = newTabs.findIndex((t) => t.id === draggedId);
      const overIndex = newTabs.findIndex((t) => t.id === overId);
      if (draggedIndex === -1 || overIndex === -1) return newTabs;
      // Swap positions
      const [draggedTab] = newTabs.splice(draggedIndex, 1);
      newTabs.splice(overIndex, 0, draggedTab);
      return newTabs;
    });
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); // No additional logic needed; order updated in dragOver
  };

  // Toggle between expanding and collapsing all nodes
  const handleToggleExpandAll = () => {
    if (!treeStructure) return;
    const allPaths = getAllDirectoryPaths(getCurrentStructure(), treeCurrentPath);
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
        setTreeCurrentPath([]);
        setTabs([]);
        setActiveTabId(0);
        setNextTabId(1);
        setFileColors(new Map());
        setExpandedNodes(new Set());
        setTreeSelectedItems([]);
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

  const TreeNode = ({ structure, parentPath = [], prefix = "", expandedNodes, selectedItems, fileColors, onFolderClick, onFileClick }: TreeNodeProps) => {
    const entries = Object.entries(structure).sort((a, b) => {
      const aIsDir = typeof a[1] === "object" && a[1] !== null;
      const bIsDir = typeof b[1] === "object" && b[1] !== null;
      if (aIsDir && !bIsDir) return -1;
      if (!aIsDir && bIsDir) return 1;
      return a[0].localeCompare(b[0]);
    });
  
    return (
      <>
        {entries.map(([name, value], index) => {
          const isLast = index === entries.length - 1;
          const connector = isLast ? '└─ ' : '├─ ';
          const isDir = typeof value === "object" && value !== null;
          const itemPath = [...parentPath, name].join("/");
          const isExpanded = expandedNodes.has(itemPath);
          const isSelected = selectedItems.includes(itemPath);
          const fileColor = !isDir ? fileColors.get(itemPath) : undefined;
  
          return (
            <div key={itemPath} className="cursor-pointer tree-node" style={{ marginBottom: '0.1rem' }}>
              <div className="flex items-center">
                <div className="flex font-mono whitespace-pre ascii-connector">
                  {prefix.match(/.{1,3}/g)?.map((segment, i) => (
                    <span key={`${itemPath}-${i}`}>{segment}</span>
                  ))}
                  <span>{connector}</span>
                </div>
                {isDir ? (
                  <span
                    onClick={(e) => onFolderClick(name, parentPath, e)}
                    className={`hover:underline ${isSelected ? "bg-blue-600 text-blue-200 px-1 rounded" : "text-blue-400"}`}
                  >
                    {name}/ {isExpanded ? '[-]' : '[+]'}
                  </span>
                ) : (
                  <span
                    onClick={(e) => onFileClick(name, parentPath, e)}
                    className={`hover:underline ${isSelected ? "bg-yellow-600 text-white px-1 rounded" : ""} ${fileColor ? `text-${fileColor}-400` : ""}`}
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
                  expandedNodes={expandedNodes}
                  selectedItems={selectedItems}
                  fileColors={fileColors}
                  onFolderClick={onFolderClick}
                  onFileClick={onFileClick}
                />
              )}
            </div>
          );
        })}
      </>
    );
  };
  
  const renderFileContentWithLines = (content: string | null) => {
    if (!content) return <p>Loading...</p>;
    const lines = content.split('\n');
    return (
      <pre className="text-sm text-gray-300 font-mono whitespace-pre overflow-x-scroll max-w-none">
        {lines.map((line, index) => (
          <div key={index} className="flex min-w-0">
            <span className="inline-block w-8 text-right pr-2 select-none text-gray-500 flex-shrink-0">
              {index + 1}
            </span>
            <span className="whitespace-nowrap inline-block">{line}</span> {/* Prevent wrapping */}
          </div>
        ))}
      </pre>
    );
  };
  
  const renderTree = () => {
    const rootName = treeCurrentPath.length === 0 ? repoDetails.repo : treeCurrentPath[treeCurrentPath.length - 1];
    return (
      <div className="text-sm text-gray-300 font-mono">
        <div className="mb-1">
          <span>{rootName}</span>
        </div>
        <TreeNode
          structure={getCurrentStructure()}
          parentPath={treeCurrentPath}
          expandedNodes={expandedNodes}
          selectedItems={treeSelectedItems}
          fileColors={fileColors}
          onFolderClick={handleFolderClick}
          onFileClick={handleFileClick}
        />
      </div>
    );
  };
  
  const { allDirectoryPaths, isFullyExpanded } = useMemo(() => {
    if (!treeStructure) return { allDirectoryPaths: [], isFullyExpanded: false };
    const allPaths = getAllDirectoryPaths(getCurrentStructure(), treeCurrentPath);
    const fullyExpanded = allPaths.length > 0 && expandedNodes.size === allPaths.length;
    return { allDirectoryPaths: allPaths, isFullyExpanded: fullyExpanded };
  }, [treeStructure, treeCurrentPath, expandedNodes]);

  // Handle clicking on source file links
  const handleSourceFileClick = (filePath: string) => {
    if (repoDetails.owner && repoDetails.repo && repoDetails.defaultBranch) {
      // Open in tab
      if (tabs.length === 0 || !activeTab) {
        addFileTab(filePath);
      } else {
        handleOpenFileInTab(activeTabId, filePath);
      }

      // Navigate tree to make file visible
      if (treeStructure && allFilePaths.length > 0) {
        const pathParts = filePath.split('/');
        const dirParts = pathParts.slice(0, -1);
        setTreeCurrentPath(dirParts);

        // Expand all ancestor directories
        const parentPaths: string[] = [];
        for (let i = 1; i <= dirParts.length; i++) {
          parentPaths.push(pathParts.slice(0, i).join('/'));
        }
        setExpandedNodes(prev => {
          const newSet = new Set(prev);
          parentPaths.forEach(path => newSet.add(path));
          return newSet;
        });

        // Scroll to the file in the tree
        setTimeout(() => {
          const fileElement = treeContainerRef.current?.querySelector(`[data-file-path="${filePath}"]`);
          if (fileElement) {
            fileElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }
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
      <div className="flex w-full max-w-7xl flex-1 gap-4 overflow-hidden">
        {/* Merged Panel: Repository Structure and Code UI */}
        <div className="flex flex-1 bg-gray-900/70 border border-gray-700 rounded-xl shadow-lg overflow-hidden">
          {/* Tree Section */}
          <div className="flex flex-col p-1 min-w-[200px] max-w-[40%] flex-shrink-0">
            <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Enter a GitHub repository URL"
                className="flex-1 p-3 border border-gray-600 bg-gray-800 text-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button type="submit" className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all">
                Send
              </button>
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

            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xl font-bold text-gray-300">Repository Structure</h3>
              {treeStructure && allDirectoryPaths.length > 0 && (
                <button
                  onClick={handleToggleExpandAll}
                  className="font-mono text-lg text-gray-400 hover:text-white px-2"
                  title="Toggle Expand/Collapse All"
                >
                  {isFullyExpanded ? '[-]' : '[+]'}
                </button>
              )}
            </div>
  
            <div ref={treeContainerRef} className="flex-1 overflow-auto bg-gray-900 p-2 rounded-md">
              {isLoadingTree && <p className="text-gray-400">Loading tree...</p>}
              {treeError && <p className="text-red-400">{treeError}</p>}
              {treeStructure && (
                <>
                  {treeCurrentPath.length > 0 && (
                    <div className="mb-4">
                      <button
                        onClick={handleTreeBackClick}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
                      >
                        Back
                      </button>
                    </div>
                  )}
                  {renderTree()}
                </>
              )}
              {!isLoadingTree && !treeError && !treeStructure && (
                <p className="text-gray-500">Enter a repository URL to see its structure here.</p>
              )}
            </div>
          </div>
  
          {/* Code Section */}
          <div className="flex-1 flex flex-col pt-2 pr-2 pb-2 pl-0 max-w-full">
          <div className="flex overflow-x-auto border-b border-gray-700 mb-2">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                draggable // Enable dragging
                onDragStart={(e) => handleDragStart(e, tab.id)}
                onDragOver={(e) => handleDragOver(e, tab.id)}
                onDrop={handleDrop}
                className={`flex-shrink-0 px-4 py-2 cursor-pointer flex items-center ${
                  tab.id === activeTabId
                    ? "bg-gray-800 text-white border-t border-l border-r border-gray-500"
                    : "text-gray-400"
                }`}
                onClick={() => setActiveTabId(tab.id)}
              >
                <span className={`text-${tab.color}-400 truncate`}>{tab.name}</span>
                <span
                  className="ml-2 text-gray-400 hover:text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                >
                  x
                </span>
              </div>
            ))}
            <div
              className="flex-shrink-0 px-4 py-2 cursor-pointer text-gray-400"
              onClick={addNewBlankTab}
            >
              +
            </div>
          </div>
          <div className="flex-1 overflow-x-visible overflow-y-auto bg-gray-900 p-0 rounded-md max-w-none">
             {activeTab ? (
                activeTab.filePath ? (
                  renderFileContentWithLines(activeTab.fileContent)
                ) : (
                  <p className="text-gray-500 p-2">Select a file by clicking in the explorer to load content here.</p>
                )
              ) : (
                <p className="text-gray-500 p-2">Open a file from the explorer on the left.</p>
              )}
            </div>
          </div>
        </div>
  
        {/* Right Panel: Chat Window */}
        <div className="w-1/4 bg-gray-900/70 border border-gray-700 p-6 rounded-xl shadow-lg flex flex-col min-w-[250px]">
          <div ref={chatMessagesRef} className="flex-1 overflow-y-auto">
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
