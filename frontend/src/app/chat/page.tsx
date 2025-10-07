"use client";
import { useMemo, useRef, useState, useEffect } from "react";
import type { ChangeEvent, DragEvent, FormEvent, KeyboardEvent, MouseEvent } from "react";
import TreePanel from "./components/TreePanel";
import CodeViewer from "./components/CodeViewer";
import ChatPanel from "./components/ChatPanel";
import ClearChatModal from "./components/ClearChatModal";
import ClearRepositoriesModal from "./components/ClearRepositoriesModal";
import { getAllDirectoryPaths, getAllFilePaths } from "./utils/tree";
import type { Message, RepoDetails, Tab, TreeStructure } from "./types";

const createInitialMessages = (): Message[] => [
  {
    sender: "bot",
    text: "\u{1F916} Welcome to RepoRover! Please enter a GitHub repository URL to get started.\n\n\u{1F4A1} **Tip:** Use @filename.py to tag files for detailed explanations!",
    sourceFiles: [],
  },
];

export default function Chat() {
  const [url, setUrl] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [messages, setMessages] = useState<Message[]>(createInitialMessages);
  const [inputMessage, setInputMessage] = useState("");
  const [treeStructure, setTreeStructure] = useState<TreeStructure | null>(null);
  const [repoDetails, setRepoDetails] = useState<RepoDetails>({ owner: "", repo: "", defaultBranch: "" });
  const [isLoadingTree, setIsLoadingTree] = useState(false);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [allFilePaths, setAllFilePaths] = useState<string[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteOptions, setAutocompleteOptions] = useState<string[]>([]);
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);
  const [atPosition, setAtPosition] = useState<number>(-1);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showClearChatConfirm, setShowClearChatConfirm] = useState(false);
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
  const [draggedTabId, setDraggedTabId] = useState<number | null>(null);
  const [isCodeViewerMounted, setIsCodeViewerMounted] = useState(false);

  const activeTab = useMemo(() => tabs.find((t) => t.id === activeTabId), [tabs, activeTabId]);
  const hasOpenTabs = tabs.length > 0;
  const treePanelClassName = hasOpenTabs
    ? "flex flex-col p-1 flex-shrink-0 basis-[45%] max-w-[620px] min-w-[300px] transition-all duration-300 ease-in-out"
    : "flex flex-col p-1 flex-1 min-w-0 transition-all duration-300 ease-in-out";

  const chatPanelClassName = hasOpenTabs
    ? "bg-gray-900/70 border border-gray-700 p-6 rounded-xl shadow-lg flex flex-col flex-shrink-0 basis-[45%] min-w-[300px] max-w-[600px]"
    : "bg-gray-900/70 border border-gray-700 p-6 rounded-xl shadow-lg flex flex-col flex-shrink-0 flex-1 min-w-0";

  // Auto-scroll chat to bottom when new messages are added
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (hasOpenTabs) {
      setIsCodeViewerMounted(true);
      return;
    }
    const timeout = setTimeout(() => setIsCodeViewerMounted(false), 300);
    return () => clearTimeout(timeout);
  }, [hasOpenTabs]);

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

  const handleSubmit = async (e: FormEvent) => {
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
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;

    setInputMessage(value);

    const atIndex = value.lastIndexOf("@", cursorPos - 1);

    if (atIndex !== -1 && cursorPos > atIndex) {
      const afterAt = value.substring(atIndex + 1, cursorPos);

      if (!afterAt.includes(" ") && !afterAt.includes("@")) {
        const matches = allFilePaths
          .filter((path) => path.toLowerCase().includes(afterAt.toLowerCase()))
          .slice(0, 5);

        setAutocompleteOptions(matches);
        setAtPosition(atIndex);
        setAutocompleteIndex(0);
        setShowAutocomplete(matches.length > 0);
      } else {
        setShowAutocomplete(false);
      }
    } else {
      setShowAutocomplete(false);
    }
  };

  // Handle keyboard navigation in autocomplete
  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
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
      handleAutocompleteSelect(selectedPath);
    } else if (e.key === 'Escape') {
      setShowAutocomplete(false);
    }
  };

  const handleChatSubmit = async (e: FormEvent) => {
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

  const handleAutocompleteSelect = (option: string) => {
    const beforeAt = inputMessage.substring(0, atPosition);
    const afterAt = inputMessage.substring(atPosition + 1);
    const atEnd = afterAt.indexOf(" ") !== -1 ? afterAt.indexOf(" ") : afterAt.length;
    const afterSelection = afterAt.substring(atEnd);
    const newInput = `${beforeAt}@${option}${afterSelection}`;
    setInputMessage(newInput);
    setShowAutocomplete(false);
    setTimeout(() => {
      if (inputRef.current) {
        const newPos = beforeAt.length + option.length + 1;
        inputRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  const handleClearChat = () => {
    setMessages(createInitialMessages());
    setInputMessage("");
    setShowAutocomplete(false);
    setShowClearChatConfirm(false);
  }; 

  const getCurrentStructure = (): TreeStructure => {
    if (!treeStructure) return {};

    let current = treeStructure;
    for (const part of treeCurrentPath) {
      current = current?.[part] as TreeStructure;
    }
    return current || {};
  };

  const handleFolderClick = (name: string, currentParentPath: string[], e: MouseEvent) => {
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

  const handleFileClick = (name: string, parentPath: string[], e: MouseEvent) => {
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

  const handleDragStart = (e: DragEvent, draggedId: number) => {
    e.dataTransfer.setData("text/plain", String(draggedId));
    e.dataTransfer.effectAllowed = "move";
    setDraggedTabId(draggedId);
    setActiveTabId(draggedId);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const currentStructure = useMemo(() => getCurrentStructure(), [treeStructure, treeCurrentPath]);

  const reorderTabs = (targetId: number | null) => {
    setTabs((prevTabs) => {
      if (draggedTabId === null || draggedTabId === targetId) return prevTabs;
      const newTabs = [...prevTabs];
      const draggedIndex = newTabs.findIndex((t) => t.id === draggedTabId);
      if (draggedIndex === -1) return prevTabs;

      const [draggedTab] = newTabs.splice(draggedIndex, 1);

      if (targetId === null) {
        newTabs.push(draggedTab);
        return newTabs;
      }

      let targetIndex = newTabs.findIndex((t) => t.id === targetId);
      if (targetIndex === -1) return prevTabs;

      if (draggedIndex < targetIndex) {
        targetIndex -= 1;
      }

      newTabs.splice(targetIndex, 0, draggedTab);
      return newTabs;
    });
  };

  const handleDrop = (e: DragEvent, targetId: number | null) => {
    e.preventDefault();
    reorderTabs(targetId);
    setDraggedTabId(null);
  };

  const handleDragEnd = () => setDraggedTabId(null);

  const { allDirectoryPaths, isFullyExpanded } = useMemo(() => {
    if (!treeStructure) {
      return { allDirectoryPaths: [], isFullyExpanded: false };
    }

    const allPaths = getAllDirectoryPaths(currentStructure, treeCurrentPath);
    const fullyExpanded = allPaths.length > 0 && expandedNodes.size === allPaths.length;
    return { allDirectoryPaths: allPaths, isFullyExpanded: fullyExpanded };
  }, [treeStructure, treeCurrentPath, expandedNodes, currentStructure]);

  // Toggle between expanding and collapsing all nodes
  const handleToggleExpandAll = () => {
    if (!treeStructure) return;
    const allPaths = getAllDirectoryPaths(currentStructure, treeCurrentPath);
    // If not all nodes are expanded, expand them all. Otherwise, collapse them.
    if (expandedNodes.size < allPaths.length) {
      setExpandedNodes(new Set(allPaths));
    } else {
      setExpandedNodes(new Set());
    }
  };

  const handleSourceFileClick = (filePath: string) => {
    if (!repoDetails.owner || !repoDetails.repo || !repoDetails.defaultBranch) {
      return;
    }

    if (tabs.length === 0 || !activeTab) {
      addFileTab(filePath);
    } else {
      handleOpenFileInTab(activeTabId, filePath);
    }

    if (!treeStructure || allFilePaths.length === 0) {
      return;
    }

    const pathParts = filePath.split("/");
    const dirParts = pathParts.slice(0, -1);
    setTreeCurrentPath(dirParts);

    const parentPaths: string[] = [];
    for (let i = 1; i <= dirParts.length; i++) {
      parentPaths.push(pathParts.slice(0, i).join("/"));
    }

    setExpandedNodes((prev) => {
      const newSet = new Set(prev);
      parentPaths.forEach((path) => newSet.add(path));
      return newSet;
    });

    setTimeout(() => {
      const fileElement = treeContainerRef.current?.querySelector(
        `[data-file-path="${filePath}"]`
      );
      if (fileElement instanceof HTMLElement) {
        fileElement.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);
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



  return (
    <main className="flex flex-col items-center bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white p-4 gap-4" style={{ height: '100vh' }}>
      {/* Chat UI */}
      <h2 className="text-4xl font-bold text-blue-400 drop-shadow-md">
        RepoRover Chat
      </h2>
      <div className="flex w-full max-w-[120rem] flex-1 gap-4 overflow-hidden">
        {/* Merged Panel: Repository Structure and Code UI */}
        <div className="flex flex-1 bg-gray-900/70 border border-gray-700 rounded-xl shadow-lg overflow-hidden">
          <TreePanel
            className={treePanelClassName}
            url={url}
            onUrlChange={(value) => setUrl(value)}
            onSubmit={handleSubmit}
            onClearRepositoriesClick={() => setShowClearConfirm(true)}
            treeStructure={treeStructure}
            treeError={treeError}
            isLoadingTree={isLoadingTree}
            treeCurrentPath={treeCurrentPath}
            onTreeBackClick={handleTreeBackClick}
            currentStructure={currentStructure}
            repoDetails={repoDetails}
            expandedNodes={expandedNodes}
            selectedItems={treeSelectedItems}
            fileColors={fileColors}
            onFolderClick={handleFolderClick}
            onFileClick={handleFileClick}
            onToggleExpandAll={handleToggleExpandAll}
            hasDirectories={allDirectoryPaths.length > 0}
            isFullyExpanded={isFullyExpanded}
            treeContainerRef={treeContainerRef}
          />
  
          {/* Code Section */}
          {(isCodeViewerMounted || hasOpenTabs) && (
            <div
              className={`flex flex-col transition-all duration-300 ease-in-out overflow-hidden ${
                hasOpenTabs
                  ? "flex-[1.6] opacity-100 translate-x-0 pt-2 pr-2 pb-2 pl-0 max-w-full min-w-0"
                  : "flex-[0] opacity-0 -translate-x-4 max-w-0 p-0 pointer-events-none"
              }`}
              aria-hidden={!hasOpenTabs}
            >
              <CodeViewer
                className="flex-1 flex flex-col pt-2 pr-2 pb-2 pl-0 max-w-full min-w-0"
                tabs={tabs}
                activeTabId={activeTabId}
                activeTab={activeTab}
                onTabSelect={(id) => setActiveTabId(id)}
                onTabClose={closeTab}
                onAddBlankTab={addNewBlankTab}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
              />
            </div>
          )}
        </div>
  
        {/* Right Panel: Chat Window */}
        <ChatPanel
          className={chatPanelClassName}
          messages={messages}
          chatMessagesRef={chatMessagesRef}
          onSourceFileClick={handleSourceFileClick}
          onClearChatClick={() => setShowClearChatConfirm(true)}
          inputRef={inputRef}
          inputMessage={inputMessage}
          onInputChange={handleInputChange}
          onInputKeyDown={handleInputKeyDown}
          onSubmit={handleChatSubmit}
          repoUrl={repoUrl}
          showAutocomplete={showAutocomplete}
          autocompleteOptions={autocompleteOptions}
          autocompleteIndex={autocompleteIndex}
          onAutocompleteSelect={handleAutocompleteSelect}
        />
      </div>

      <ClearChatModal
        isOpen={showClearChatConfirm}
        onCancel={() => setShowClearChatConfirm(false)}
        onConfirm={handleClearChat}
      />

      <ClearRepositoriesModal
        isOpen={showClearConfirm}
        isClearing={isClearing}
        onCancel={() => setShowClearConfirm(false)}
        onConfirm={handleClearRepositories}
      />
    </main>
  );
}
