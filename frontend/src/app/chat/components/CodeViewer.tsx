"use client";
import { useState, type DragEvent } from "react";
import type { Tab } from "../types";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { X, Plus, Copy, Check, ShieldAlert } from "lucide-react";

interface CodeViewerProps {
  className: string;
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
  onAssessActiveFile: (filePath: string) => void;
  isAssessingFile: boolean;
  canAssessFiles: boolean;
}

const CopyButton = ({ content }: { content: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-2 rounded-md hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
      title="Copy code"
    >
      {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
    </button>
  );
};

const renderFileContent = (tab: Tab | undefined) => {
  if (!tab) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <p>Open a file from the explorer on the left.</p>
      </div>
    );
  }

  if (!tab.filePath) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <p>Select a file by clicking in the explorer to load content here.</p>
      </div>
    );
  }

  if (!tab.fileContent) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
        <p>Loading content...</p>
      </div>
    );
  }

  // Handle images
  if (tab.fileType === "image") {
    return (
      <div className="flex items-center justify-center h-full bg-black/20 p-4">
        <div className="max-w-full max-h-full overflow-auto rounded-lg shadow-lg">
          <img
            src={`data:${tab.contentType};base64,${tab.fileContent}`}
            alt={tab.name}
            className="max-w-full h-auto"
            style={{ maxHeight: '80vh' }}
          />
          <p className="text-center text-gray-400 mt-2 text-sm">{tab.name}</p>
        </div>
      </div>
    );
  }

  // Handle PDFs
  if (tab.fileType === "pdf") {
    return (
      <div className="h-full w-full bg-gray-900">
        <iframe
          src={`data:application/pdf;base64,${tab.fileContent}`}
          className="w-full h-full border-none"
          title={tab.name}
        />
      </div>
    );
  }

  // Determine language for syntax highlighting
  const extension = tab.name.split('.').pop()?.toLowerCase() || 'text';
  const languageMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'jsx',
    ts: 'typescript',
    tsx: 'tsx',
    py: 'python',
    rb: 'ruby',
    java: 'java',
    go: 'go',
    rs: 'rust',
    c: 'c',
    cpp: 'cpp',
    h: 'cpp',
    css: 'css',
    html: 'html',
    json: 'json',
    md: 'markdown',
    yml: 'yaml',
    yaml: 'yaml',
    sh: 'bash',
    bash: 'bash',
    sql: 'sql',
  };
  const language = languageMap[extension] || 'text';

  return (
    <div className="relative h-full group">
      <div className="absolute top-2 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded-md backdrop-blur-sm">
        <CopyButton content={tab.fileContent} />
      </div>
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          padding: '1.5rem',
          height: '100%',
          fontSize: '0.875rem',
          lineHeight: '1.5',
          background: 'transparent',
        }}
        showLineNumbers={true}
        lineNumberStyle={{
          minWidth: '3em',
          paddingRight: '1em',
          color: '#4b5563',
          textAlign: 'right',
        }}
      >
        {tab.fileContent}
      </SyntaxHighlighter>
    </div>
  );
};

const CodeViewer = ({
  className,
  tabs,
  activeTabId,
  activeTab,
  onTabSelect,
  onTabClose,
  onAddBlankTab,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onAssessActiveFile,
  isAssessingFile,
  canAssessFiles,
}: CodeViewerProps) => (
  <div className={`${className} flex flex-col bg-[#1e1e1e]/50 backdrop-blur-sm`}>
    {/* Tab Bar */}
    <div className="flex items-center bg-[#1e1e1e]/80 border-b border-white/5 px-2 pt-2 overflow-x-auto no-scrollbar">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          draggable
          onDragStart={(event) => onDragStart(event, tab.id)}
          onDragOver={onDragOver}
          onDrop={(event) => onDrop(event, tab.id)}
          onDragEnd={onDragEnd}
          className={`
            group relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium cursor-pointer transition-all
            border-t-2 rounded-t-lg min-w-[120px] max-w-[200px]
            ${tab.id === activeTabId
              ? "bg-[#1e1e1e] text-blue-400 border-blue-500"
              : "bg-transparent text-gray-400 border-transparent hover:bg-white/5 hover:text-gray-200"
            }
          `}
          onClick={() => onTabSelect(tab.id)}
        >
          <span className="truncate flex-1">{tab.name}</span>
          <button
            type="button"
            className={`
              p-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-all
              ${tab.id === activeTabId ? "hover:bg-white/10 text-gray-400 hover:text-white" : "hover:bg-white/10 text-gray-500 hover:text-gray-300"}
            `}
            onClick={(event) => {
              event.stopPropagation();
              onTabClose(tab.id);
            }}
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="ml-1 p-2 text-gray-500 hover:text-gray-300 hover:bg-white/5 rounded-md transition-colors"
        onClick={onAddBlankTab}
        onDragOver={onDragOver}
        onDrop={(event) => onDrop(event, null)}
        title="New Tab"
      >
        <Plus size={16} />
      </button>
    </div>

    {/* Toolbar */}
    {activeTab?.filePath && (
      <div className="flex items-center justify-between px-4 py-2 bg-[#1e1e1e]/40 border-b border-white/5">
        <div className="text-xs text-gray-500 font-mono truncate">
          {activeTab.filePath}
        </div>
        <button
          type="button"
          className={`
            flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all
            ${isAssessingFile
              ? "bg-blue-500/20 text-blue-300 cursor-wait"
              : canAssessFiles
                ? "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20"
                : "opacity-50 cursor-not-allowed text-gray-500"
            }
          `}
          onClick={() => onAssessActiveFile(activeTab.filePath!)}
          disabled={isAssessingFile || !canAssessFiles}
        >
          <ShieldAlert size={14} />
          {isAssessingFile ? "Assessing..." : "Assess Security"}
        </button>
      </div>
    )}

    {/* Content Area */}
    <div className="flex-1 overflow-hidden bg-[#1e1e1e]/30 relative">
      {renderFileContent(activeTab)}
    </div>
  </div>
);

export default CodeViewer;

