"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ChangeEvent,
  DragEvent,
  FormEvent,
  KeyboardEvent,
  MouseEvent,
  RefObject,
} from "react";
import { getAllDirectoryPaths, getAllFilePaths } from "../utils/tree";
import type { Message, RepoDetails, Tab, TreeStructure } from "../types";

const createInitialMessages = (): Message[] => [
  {
    sender: "bot",
    text: "\u{1F916} Welcome to RepoRover! Please enter a GitHub repository URL to get started.\n\n\u{1F4A1} **Tip:** Use @filename.py to tag files for detailed explanations!",
    sourceFiles: [],
  },
];

const githubRegex =
  /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/;

const API_KEY_STORAGE_KEY = "reporover:openai_api_key";
const API_KEY_UPDATED_AT_STORAGE_KEY = "reporover:openai_api_key_updated_at";
const DEBUG_FORCE_ENV_KEY = "reporover:debug_force_env_key";
const DEBUG_FORCE_USER_KEY = "reporover:debug_force_user_key";

interface LayoutConfig {
  treePanelClassName: string;
  leftContainerClassName: string;
  chatPanelClassName: string;
  hasDirectories: boolean;
  isFullyExpanded: boolean;
  treeContainerRef: RefObject<HTMLDivElement | null>;
  isApiKeySet: boolean;
  onManageApiKeyClick: () => void;
}

export interface CodeViewerBinding {
  tabs: Tab[];
  activeTabId: number;
  activeTab?: Tab;
  onTabSelect: (tabId: number) => void;
  onTabClose: (tabId: number) => void;
  onAddBlankTab: () => void;
  onDragStart: (event: DragEvent, tabId: number) => void;
  onDragOver: (event: DragEvent) => void;
  onDrop: (event: DragEvent, targetTabId: number | null) => void;
  onDragEnd: () => void;
}

export interface TreePanelBinding {
  url: string;
  onUrlChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClearRepositoriesClick: () => void;
  treeStructure: TreeStructure | null;
  treeError: string | null;
  isLoadingTree: boolean;
  treeCurrentPath: string[];
  onTreeBackClick: () => void;
  currentStructure: TreeStructure;
  repoDetails: RepoDetails;
  expandedNodes: Set<string>;
  selectedItems: string[];
  fileColors: Map<string, string>;
  onFolderClick: (name: string, parentPath: string[], event: MouseEvent) => void;
  onFileClick: (name: string, parentPath: string[], event: MouseEvent) => void;
  onToggleExpandAll: () => void;
  hasDirectories: boolean;
  isFullyExpanded: boolean;
  treeContainerRef: RefObject<HTMLDivElement | null>;
  isApiKeySet: boolean;
  effectiveHasApiKey: boolean;
  onManageApiKeyClick: () => void;
  debugForceEnv: boolean;
}

export interface ChatPanelBinding {
  messages: Message[];
  chatMessagesRef: RefObject<HTMLDivElement | null>;
  onSourceFileClick: (filePath: string) => void;
  onClearChatClick: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
  inputMessage: string;
  onInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  repoUrl: string;
  showAutocomplete: boolean;
  autocompleteOptions: string[];
  autocompleteIndex: number;
  onAutocompleteSelect: (option: string) => void;
  isChatEnabled: boolean;
  inputPlaceholder: string;
  onManageApiKeyClick: () => void;
}

export interface ClearChatModalBinding {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export interface ClearRepositoriesModalBinding {
  isOpen: boolean;
  isClearing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export interface ApiKeyManagerBinding {
  hasApiKey: boolean;
  maskedKey: string;
  isModalOpen: boolean;
  currentValue: string;
  updatedAtLabel: string | null;
  onOpen: () => void;
  onClose: () => void;
  onSave: (value: string) => void;
  onClear: () => void;
  debugForceEnv: boolean;
  debugForceUser: boolean;
  onToggleDebugForceEnv: () => void;
  onToggleDebugForceUser: () => void;
}

interface UseChatPageStateResult {
  layout: LayoutConfig;
  treePanel: TreePanelBinding;
  codeViewer: CodeViewerBinding;
  chatPanel: ChatPanelBinding;
  clearChatModal: ClearChatModalBinding;
  clearRepositoriesModal: ClearRepositoriesModalBinding;
  apiKeyManager: ApiKeyManagerBinding;
}

const useChatPageState = (): UseChatPageStateResult => {
  const [url, setUrl] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [messages, setMessages] = useState<Message[]>(createInitialMessages);
  const [inputMessage, setInputMessage] = useState("");
  const [treeStructure, setTreeStructure] = useState<TreeStructure | null>(null);
  const [repoDetails, setRepoDetails] = useState<RepoDetails>({
    owner: "",
    repo: "",
    defaultBranch: "",
  });
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
  const [apiKey, setApiKey] = useState("");
  const [apiKeyUpdatedAt, setApiKeyUpdatedAt] = useState<string | null>(null);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [debugForceEnv, setDebugForceEnv] = useState(false);
  const [debugForceUser, setDebugForceUser] = useState(false);

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId),
    [tabs, activeTabId]
  );
  const hasOpenTabs = tabs.length > 0;

  const persistApiKey = (value: string) => {
    if (typeof window === "undefined") return;
    if (value) {
      const timestamp = new Date().toISOString();
      window.localStorage.setItem(API_KEY_STORAGE_KEY, value);
      window.localStorage.setItem(
        API_KEY_UPDATED_AT_STORAGE_KEY,
        timestamp
      );
      setApiKeyUpdatedAt(timestamp);
    } else {
      window.localStorage.removeItem(API_KEY_STORAGE_KEY);
      window.localStorage.removeItem(API_KEY_UPDATED_AT_STORAGE_KEY);
      setApiKeyUpdatedAt(null);
    }
  };

  const handleClearApiKey = () => {
    const hadKey = Boolean(apiKey);
    setApiKey("");
    persistApiKey("");

    if (hadKey) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "🔑 OpenAI API key removed. Add a key to continue ingesting repositories.",
          sourceFiles: [],
        },
      ]);
    }
  };

  const toggleDebugForceEnv = () => {
    const newValue = !debugForceEnv;
    setDebugForceEnv(newValue);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DEBUG_FORCE_ENV_KEY, newValue.toString());
    }

    if (newValue) {
      setDebugForceUser(false);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(DEBUG_FORCE_USER_KEY, "false");
      }
      // Force reload from environment
      const envApiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
      if (envApiKey) {
        setApiKey(envApiKey);
        setApiKeyUpdatedAt(new Date().toISOString());
        setMessages((prev) => [
          ...prev,
          {
            sender: "bot",
            text: "🔧 Debug mode: Now using OpenAI API key from environment variables.",
            sourceFiles: [],
          },
        ]);
      }
    } else {
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "🔧 Debug mode: Environment key forcing disabled.",
          sourceFiles: [],
        },
      ]);
    }
  };

  const toggleDebugForceUser = () => {
    const newValue = !debugForceUser;
    setDebugForceUser(newValue);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DEBUG_FORCE_USER_KEY, newValue.toString());
    }

    if (newValue) {
      setDebugForceEnv(false);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(DEBUG_FORCE_ENV_KEY, "false");
      }
      // Clear current key to force user input
      setApiKey("");
      setApiKeyUpdatedAt(null);
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "🔧 Debug mode: Now requiring user input for OpenAI API key.",
          sourceFiles: [],
        },
      ]);
    } else {
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "🔧 Debug mode: User key forcing disabled.",
          sourceFiles: [],
        },
      ]);
    }
  };

  const handleSaveApiKey = (value: string) => {
    const trimmed = value.trim();
    const hadKey = Boolean(apiKey);

    if (!trimmed) {
      handleClearApiKey();
      setIsApiKeyModalOpen(false);
      return;
    }

    setApiKey(trimmed);
    persistApiKey(trimmed);
    setIsApiKeyModalOpen(false);

    if (!hadKey) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "🔑 OpenAI API key saved locally. You're ready to ingest repositories.",
          sourceFiles: [],
        },
      ]);
    }
  };

  const hasApiKey = Boolean(apiKey.trim());
  const maskedApiKey = useMemo(() => {
    if (!hasApiKey) return "";
    const trimmed = apiKey.trim();
    if (trimmed.length <= 6) {
      return `${trimmed[0]}${"•".repeat(Math.max(trimmed.length - 2, 0))}${trimmed.slice(-1)}`;
    }
    return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`;
  }, [apiKey, hasApiKey]);

  const apiKeyUpdatedAtLabel = useMemo(() => {
    if (!apiKeyUpdatedAt) return null;
    try {
      return new Date(apiKeyUpdatedAt).toLocaleString();
    } catch {
      return apiKeyUpdatedAt;
    }
  }, [apiKeyUpdatedAt]);

  const panelTransition =
    "transition-[flex-basis,max-width,min-width,opacity,transform,padding] duration-500 ease-in-out";

  const treePanelClassName = hasOpenTabs
    ? `flex flex-col p-1 flex-shrink-0 basis-[43%] max-w-[620px] min-w-[300px] ${panelTransition}`
    : `flex flex-col p-1 flex-1 min-w-0 grow ${panelTransition}`;

  const leftContainerClassName = hasOpenTabs
    ? `flex bg-gray-900/70 border border-gray-700 rounded-xl shadow-lg overflow-hidden basis-[70%] flex-shrink-0 ${panelTransition}`
    : `flex bg-gray-900/70 border border-gray-700 rounded-xl shadow-lg overflow-hidden flex-1 ${panelTransition}`;

  const chatPanelClassName = hasOpenTabs
    ? `bg-gray-900/70 border border-gray-700 p-6 rounded-xl shadow-lg flex flex-col flex-shrink-0 basis-[30%] max-w-[75%] min-w-[320px] ${panelTransition}`
    : `bg-gray-900/70 border border-gray-700 p-6 rounded-xl shadow-lg flex flex-col flex-shrink-0 basis-[50%] max-w-[75%] min-w-[320px] ${panelTransition}`;

  // When forcing environment variable and it exists, treat as having API key
  // In debug mode, allow functionality even if env var not set for testing
  const effectiveHasApiKey = hasApiKey || debugForceEnv;

  const isChatEnabled = Boolean(repoUrl && (effectiveHasApiKey || debugForceEnv));
  const chatInputPlaceholder = !repoUrl
    ? "First enter a repo URL above"
    : !(effectiveHasApiKey || debugForceEnv)
    ? "Add your OpenAI API key to start chatting"
    : "Ask a question about the repo or use @filename...";

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

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Load debug toggles from localStorage
    const storedDebugForceEnv = window.localStorage.getItem(DEBUG_FORCE_ENV_KEY) === "true";
    const storedDebugForceUser = window.localStorage.getItem(DEBUG_FORCE_USER_KEY) === "true";

    setDebugForceEnv(storedDebugForceEnv);
    setDebugForceUser(storedDebugForceUser);

    // Check for API key in environment variables first
    const envApiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;

    // Determine which source to use based on debug toggles
    if (storedDebugForceEnv && envApiKey) {
      // Force using environment variable
      setApiKey(envApiKey);
      setApiKeyUpdatedAt(new Date().toISOString());
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "🔧 Debug mode: Using OpenAI API key from environment variables.",
          sourceFiles: [],
        },
      ]);
    } else if (storedDebugForceUser) {
      // Force asking user for API key (don't load from localStorage)
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "🔧 Debug mode: Will prompt for OpenAI API key from user.",
          sourceFiles: [],
        },
      ]);
    } else if (envApiKey && !storedDebugForceUser) {
      // Use environment variable if available and not forcing user input
      setApiKey(envApiKey);
      setApiKeyUpdatedAt(new Date().toISOString());
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "🔑 OpenAI API key loaded from environment variables.",
          sourceFiles: [],
        },
      ]);
    } else {
      // Fall back to localStorage or prompt user
      const storedKey = window.localStorage.getItem(API_KEY_STORAGE_KEY);
      const storedUpdatedAt = window.localStorage.getItem(
        API_KEY_UPDATED_AT_STORAGE_KEY
      );

      if (storedKey) {
        setApiKey(storedKey);
      }

      if (storedUpdatedAt) {
        setApiKeyUpdatedAt(storedUpdatedAt);
      }
    }
  }, []);

  const fetchDirectoryTree = async (targetRepoUrl: string) => {
    setIsLoadingTree(true);
    setTreeError(null);
    setTreeStructure(null);
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
      const response = await fetch(`${backendUrl}/api/get_tree`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ github_url: targetRepoUrl }),
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

        const filePaths = getAllFilePaths(data.tree_structure);
        setAllFilePaths(filePaths);
      } else {
        throw new Error(data.message || "An unknown error occurred.");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error ?? "Unknown error");
      setTreeError(`Failed to load directory tree: ${message}`);
    } finally {
      setIsLoadingTree(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!url.trim()) return;

    if (!effectiveHasApiKey) {
      // Don't show modal if using environment variable in force mode
      if (!debugForceEnv) {
        setMessages((prev) => [
          ...prev,
          {
            sender: "bot",
            text: "🔑 Add your OpenAI API key before ingesting a repository.",
            sourceFiles: [],
          },
        ]);
        setIsApiKeyModalOpen(true);
      }
      return;
    }

    if (githubRegex.test(url)) {
      const trimmedUrl = url.trim();
      setRepoUrl(trimmedUrl);
      fetchDirectoryTree(trimmedUrl);

      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "🚀 Thanks! That looks like a valid GitHub repository. Starting ingestion...",
          sourceFiles: [],
        },
      ]);

      try {
        const backendUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        // Use API key from environment if forcing env mode, otherwise use stored key
        const keyToSend = debugForceEnv && process.env.NEXT_PUBLIC_OPENAI_API_KEY
          ? process.env.NEXT_PUBLIC_OPENAI_API_KEY
          : apiKey.trim();
        if (keyToSend) {
          headers["x-openai-api-key"] = keyToSend;
        }
        const response = await fetch(`${backendUrl}/api/ingest`, {
          method: "POST",
          headers,
          body: JSON.stringify({ github_url: trimmedUrl }),
        });
        const data = await response.json();

        if (data.status === "started") {
          setMessages((prev) => [
            ...prev,
            {
              sender: "bot",
              text: "✅ Repository ingestion complete. You can now ask questions about the repo.",
              sourceFiles: [],
            },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              sender: "bot",
              text: `❌ ${data.message || "Error starting ingestion"}`,
              sourceFiles: [],
            },
          ]);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            sender: "bot",
            text: "❌ Error connecting to backend. Please try again later.",
            sourceFiles: [],
          },
        ]);
      }
    }
  };

  const parseFileTags = (text: string): {
    cleanText: string;
    taggedFiles: string[];
  } => {
    const fileTagRegex = /@([^\s]+)/g;
    const taggedFiles: string[] = [];
    let match;
    while ((match = fileTagRegex.exec(text)) !== null) {
      taggedFiles.push(match[1]);
    }
    const cleanText = text.replace(fileTagRegex, "").trim();
    return { cleanText, taggedFiles };
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    const cursorPos = event.target.selectionStart || 0;

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

  const handleAutocompleteSelect = (option: string) => {
    const beforeAt = inputMessage.substring(0, atPosition);
    const afterAt = inputMessage.substring(atPosition + 1);
    const atEnd =
      afterAt.indexOf(" ") !== -1 ? afterAt.indexOf(" ") : afterAt.length;
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

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!showAutocomplete) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setAutocompleteIndex((prev) => (prev + 1) % autocompleteOptions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setAutocompleteIndex((prev) =>
        prev === 0 ? autocompleteOptions.length - 1 : prev - 1
      );
    } else if (event.key === "Enter" && showAutocomplete) {
      event.preventDefault();
      const selectedPath = autocompleteOptions[autocompleteIndex];
      handleAutocompleteSelect(selectedPath);
    } else if (event.key === "Escape") {
      setShowAutocomplete(false);
    }
  };

  const handleChatSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!inputMessage.trim() || !treeStructure || !repoUrl) return;
    if (!effectiveHasApiKey) {
      // Don't show modal if using environment variable in force mode
      if (!debugForceEnv) {
        setMessages((prev) => [
          ...prev,
          {
            sender: "bot",
            text: "🔑 Please add your OpenAI API key before starting the chat.",
            sourceFiles: [],
          },
        ]);
        setIsApiKeyModalOpen(true);
      }
      return;
    }

    const { cleanText, taggedFiles } = parseFileTags(inputMessage);

    if (!cleanText.trim() && taggedFiles.length === 0) return;

    const currentMessage = inputMessage;
    setInputMessage("");
    setShowAutocomplete(false);

    setMessages((prev) => [
      ...prev,
      { sender: "user", text: currentMessage, sourceFiles: [] },
    ]);

    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
      const payload: Record<string, unknown> = {
        query: cleanText || "Explain these files",
        github_url: repoUrl,
      };

      if (taggedFiles.length > 0) {
        payload.tagged_files = taggedFiles;
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      // Use API key from environment if forcing env mode, otherwise use stored key
      const keyToSend = debugForceEnv && process.env.NEXT_PUBLIC_OPENAI_API_KEY
        ? process.env.NEXT_PUBLIC_OPENAI_API_KEY
        : apiKey.trim();
      if (keyToSend) {
        headers["x-openai-api-key"] = keyToSend;
      }

      const response = await fetch(`${backendUrl}/api/query`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: data.response || `❌ Error: ${data.message || "Failed to query."}`,
          sourceFiles: data.source_files || [],
        },
      ]);
    } catch {
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

  const handleClearChat = () => {
    setMessages(createInitialMessages());
    setInputMessage("");
    setShowAutocomplete(false);
    setShowClearChatConfirm(false);
  };

  const getCurrentStructure = useCallback((): TreeStructure => {
    if (!treeStructure) return {};

    let current = treeStructure;
    for (const part of treeCurrentPath) {
      current = (current?.[part] as TreeStructure) || {};
    }
    return current || {};
  }, [treeStructure, treeCurrentPath]);

  const currentStructure = useMemo(
    () => getCurrentStructure(),
    [getCurrentStructure]
  );

  const handleFolderClick = (
    name: string,
    currentParentPath: string[],
    event: MouseEvent
  ) => {
    const itemPath = [...currentParentPath, name].join("/");

    if (event.metaKey) {
      const newSelectedItems = treeSelectedItems.includes(itemPath)
        ? treeSelectedItems.filter((item) => item !== itemPath)
        : [...treeSelectedItems, itemPath];
      setTreeSelectedItems(newSelectedItems);
      return;
    }

    if (event.detail === 2) {
      setTreeCurrentPath([...currentParentPath, name]);
    } else if (event.detail === 1) {
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
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
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
            {
              sender: "bot",
              text: `❌ File "${expectedPath}" not found in current repository. It may be from a different repository or the path may have changed.`,
              sourceFiles: [],
            },
          ]);
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setTabs((prevTabs) =>
        prevTabs.map((tab) =>
          tab.id === tabId && tab.filePath === expectedPath
            ? { ...tab, fileContent: data.content }
            : tab
        )
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error ?? "Unknown error");
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: `❌ Failed to fetch file content for "${expectedPath}": ${message}. This file may not exist in the current repository.`,
          sourceFiles: [],
        },
      ]);
    }
  };

  const addFileTab = (filePath: string) => {
    const name = filePath.split("/").pop() || "File";
    const colors = ["green", "yellow", "pink", "indigo"];
    const color = colors[(nextTabId - 1) % colors.length];
    const newTab: Tab = {
      id: nextTabId,
      name,
      color,
      filePath,
      fileContent: "Loading...",
    };
    setTabs((prev) => [...prev, newTab]);
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
    const name = filePath.split("/").pop() || "File";
    let color = tab.color;
    if (tab.color === "gray") {
      const colors = ["green", "yellow", "pink", "indigo"];
      color = colors[tabs.length % colors.length];
    }
    setTabs((prev) =>
      prev.map((t) =>
        t.id === tabId
          ? { ...t, name, color, filePath, fileContent: "Loading..." }
          : t
      )
    );
    fetchFileContent(filePath, tabId);
    if (oldPath && oldPath !== filePath) {
      const remainingOld = tabs.filter(
        (t) => t.id !== tabId && t.filePath === oldPath
      ).length;
      if (remainingOld === 0) {
        setFileColors((prev) => {
          const updated = new Map(prev);
          updated.delete(oldPath);
          return updated;
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

  const handleFileClick = (
    name: string,
    parentPath: string[],
    event: MouseEvent
  ) => {
    const filePath = [...parentPath, name].join("/");

    if (event.metaKey) {
      const newSelectedItems = treeSelectedItems.includes(filePath)
        ? treeSelectedItems.filter((item) => item !== filePath)
        : [...treeSelectedItems, filePath];
      setTreeSelectedItems(newSelectedItems);
      return;
    }

    if (event.detail === 1) {
      if (tabs.length === 0 || !activeTab) {
        addFileTab(filePath);
      } else {
        handleOpenFileInTab(activeTabId, filePath);
      }
    }
  };

  const addNewBlankTab = () => {
    const newId = nextTabId;
    const newTab: Tab = {
      id: newId,
      name: "Untitled",
      color: "gray",
      filePath: null,
      fileContent: null,
    };
    setTabs((prev) => [...prev, newTab]);
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
          const updated = new Map(prev);
          updated.delete(closingTab.filePath!);
          return updated;
        });
      }
    }
    if (activeTabId === id) {
      setActiveTabId(newTabs.length > 0 ? newTabs[0].id : 0);
    }
  };

  const handleDragStart = (event: DragEvent, draggedId: number) => {
    event.dataTransfer.setData("text/plain", String(draggedId));
    event.dataTransfer.effectAllowed = "move";
    setDraggedTabId(draggedId);
    setActiveTabId(draggedId);
  };

  const handleDragOver = (event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

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

  const handleDrop = (event: DragEvent, targetId: number | null) => {
    event.preventDefault();
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

  const handleToggleExpandAll = () => {
    if (!treeStructure) return;
    const allPaths = getAllDirectoryPaths(currentStructure, treeCurrentPath);
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

  const handleClearRepositories = async () => {
    setIsClearing(true);
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
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
    } catch {
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

  const layout: LayoutConfig = {
    treePanelClassName,
    leftContainerClassName,
    chatPanelClassName,
    hasDirectories: allDirectoryPaths.length > 0,
    isFullyExpanded,
    treeContainerRef,
    isApiKeySet: hasApiKey,
    onManageApiKeyClick: () => setIsApiKeyModalOpen(true),
  };

  const treePanel: TreePanelBinding = useMemo(() => ({
    url,
    onUrlChange: (value: string) => setUrl(value),
    onSubmit: handleSubmit,
    onClearRepositoriesClick: () => setShowClearConfirm(true),
    treeStructure,
    treeError,
    isLoadingTree,
    treeCurrentPath,
    onTreeBackClick: handleTreeBackClick,
    currentStructure,
    repoDetails,
    expandedNodes,
    selectedItems: treeSelectedItems,
    fileColors,
    onFolderClick: handleFolderClick,
    onFileClick: handleFileClick,
    onToggleExpandAll: handleToggleExpandAll,
    hasDirectories: allDirectoryPaths.length > 0,
    isFullyExpanded,
    treeContainerRef,
    isApiKeySet: hasApiKey,
    effectiveHasApiKey,
    onManageApiKeyClick: () => setIsApiKeyModalOpen(true),
    debugForceEnv,
  }), [
    url,
    handleSubmit,
    treeStructure,
    treeError,
    isLoadingTree,
    treeCurrentPath,
    handleTreeBackClick,
    currentStructure,
    repoDetails,
    expandedNodes,
    treeSelectedItems,
    fileColors,
    handleFolderClick,
    handleFileClick,
    handleToggleExpandAll,
    allDirectoryPaths.length,
    isFullyExpanded,
    treeContainerRef,
    hasApiKey,
    effectiveHasApiKey,
    setIsApiKeyModalOpen,
    debugForceEnv,
  ]);

  const codeViewer: CodeViewerBinding = {
    tabs,
    activeTabId,
    activeTab,
    onTabSelect: (id) => setActiveTabId(id),
    onTabClose: closeTab,
    onAddBlankTab: addNewBlankTab,
    onDragStart: handleDragStart,
    onDragOver: handleDragOver,
    onDrop: handleDrop,
    onDragEnd: handleDragEnd,
  };

  const chatPanel: ChatPanelBinding = {
    messages,
    chatMessagesRef,
    onSourceFileClick: handleSourceFileClick,
    onClearChatClick: () => setShowClearChatConfirm(true),
    inputRef,
    inputMessage,
    onInputChange: handleInputChange,
    onInputKeyDown: handleInputKeyDown,
    onSubmit: handleChatSubmit,
    repoUrl,
    showAutocomplete,
    autocompleteOptions,
    autocompleteIndex,
    onAutocompleteSelect: handleAutocompleteSelect,
    isChatEnabled,
    inputPlaceholder: chatInputPlaceholder,
    onManageApiKeyClick: () => setIsApiKeyModalOpen(true),
  };

  const clearChatModal: ClearChatModalBinding = {
    isOpen: showClearChatConfirm,
    onCancel: () => setShowClearChatConfirm(false),
    onConfirm: handleClearChat,
  };

  const clearRepositoriesModal: ClearRepositoriesModalBinding = {
    isOpen: showClearConfirm,
    isClearing,
    onCancel: () => setShowClearConfirm(false),
    onConfirm: handleClearRepositories,
  };

  const apiKeyManager: ApiKeyManagerBinding = {
    hasApiKey,
    maskedKey: maskedApiKey,
    isModalOpen: isApiKeyModalOpen,
    currentValue: apiKey,
    updatedAtLabel: apiKeyUpdatedAtLabel,
    onOpen: () => setIsApiKeyModalOpen(true),
    onClose: () => setIsApiKeyModalOpen(false),
    onSave: handleSaveApiKey,
    onClear: handleClearApiKey,
    debugForceEnv,
    debugForceUser,
    onToggleDebugForceEnv: toggleDebugForceEnv,
    onToggleDebugForceUser: toggleDebugForceUser,
  };

  return {
    layout,
    treePanel,
    codeViewer,
    chatPanel,
    clearChatModal,
    clearRepositoriesModal,
    apiKeyManager,
  };
};

export default useChatPageState;
