"use client";
import type { DragEvent } from "react";
import type { Tab } from "../types";

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
}

const renderFileContentWithLines = (content: string | null) => {
  if (!content) return <p>Loading...</p>;
  const lines = content.split("\n");
  return (
    <pre className="text-sm text-gray-300 font-mono whitespace-pre overflow-x-scroll max-w-none">
      {lines.map((line, index) => (
        <div key={index} className="flex min-w-0">
          <span className="inline-block w-8 text-right pr-2 select-none text-gray-500 flex-shrink-0">
            {index + 1}
          </span>
          <span className="whitespace-nowrap inline-block">{line}</span>
        </div>
      ))}
    </pre>
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
}: CodeViewerProps) => (
  <div className={className}>
    <div className="flex overflow-x-auto border-b border-gray-700 mb-2 bg-gray-900/40 px-2">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          draggable
          onDragStart={(event) => onDragStart(event, tab.id)}
          onDragOver={onDragOver}
          onDrop={(event) => onDrop(event, tab.id)}
          onDragEnd={onDragEnd}
          className={`flex-shrink-0 cursor-pointer flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors border border-gray-700/60 border-b-0 rounded-t-md mr-2 ${
            tab.id === activeTabId
              ? "bg-gray-800/80 text-white shadow-inner"
              : "bg-gray-900/40 text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
          }`}
          onClick={() => onTabSelect(tab.id)}
        >
          <span className={`truncate ${tab.color ? `text-${tab.color}-400` : ""}`}>{tab.name}</span>
          <button
            type="button"
            className="text-gray-500 hover:text-red-400 transition-colors"
            onClick={(event) => {
              event.stopPropagation();
              onTabClose(tab.id);
            }}
          >
            x
          </button>
        </div>
      ))}
      <button
        type="button"
        className="flex-shrink-0 cursor-pointer flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 bg-gray-900/30 hover:bg-gray-800/40 transition-colors border border-dashed border-gray-700/60 border-b-0 rounded-t-md"
        onClick={onAddBlankTab}
        onDragOver={onDragOver}
        onDrop={(event) => onDrop(event, null)}
      >
        +
      </button>
    </div>
    <div className="flex-1 overflow-x-visible overflow-y-auto bg-gray-900 p-0 rounded-md max-w-none">
      {activeTab ? (
        activeTab.filePath ? (
          renderFileContentWithLines(activeTab.fileContent)
        ) : (
          <p className="text-gray-500 p-2">
            Select a file by clicking in the explorer to load content here.
          </p>
        )
      ) : (
        <p className="text-gray-500 p-2">Open a file from the explorer on the left.</p>
      )}
    </div>
  </div>
);

export default CodeViewer;



