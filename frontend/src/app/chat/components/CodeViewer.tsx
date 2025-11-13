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
  onAssessActiveFile: (filePath: string) => void;
  isAssessingFile: boolean;
  canAssessFiles: boolean;
}

const renderFileContentWithLines = (content: string | null) => {
  if (!content) return <p>Loading...</p>;
  const lines = content.split("\n");
  return (
    <pre className="text-sm text-gray-300 font-mono whitespace-pre max-w-none">
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

const renderFileContent = (tab: Tab | undefined) => {
  if (!tab) {
    return <p className="text-gray-500 p-2">Open a file from the explorer on the left.</p>;
  }

  if (!tab.filePath) {
    return (
      <p className="text-gray-500 p-2">
        Select a file by clicking in the explorer to load content here.
      </p>
    );
  }

  // Display error state if present
  if (tab.error) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-2">⚠️ Failed to load file</p>
          <p className="text-gray-400 text-sm">{tab.error}</p>
          <p className="text-gray-500 text-xs mt-2">File: {tab.filePath}</p>
        </div>
      </div>
    );
  }

  if (!tab.fileContent) {
    return <p className="text-gray-300 p-2">Loading...</p>;
  }

  // Handle images
  if (tab.fileType === "image") {
    // Validate required fields for image rendering
    if (!tab.contentType) {
      return (
        <div className="flex items-center justify-center h-full p-4">
          <p className="text-red-400">Error: Missing content type for image</p>
        </div>
      );
    }

    // Create a unique key based on filepath and content length to force remount
    const imageKey = `${tab.filePath}-${tab.fileContent?.length || 0}`;

    return (
      <div className="flex items-center justify-center h-full bg-gray-900 p-4" key={imageKey}>
        <div className="max-w-full max-h-full overflow-auto">
          <img
            key={imageKey}
            src={`data:${tab.contentType};base64,${tab.fileContent}`}
            alt={tab.name}
            className="max-w-full h-auto"
            style={{ maxHeight: '80vh' }}
            onError={(e) => {
              console.error('Image failed to load:', tab.filePath);
              console.error('Content type:', tab.contentType);
              console.error('Content length:', tab.fileContent?.length);
              const target = e.currentTarget;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                // Clear any existing error messages first
                const existingError = parent.querySelector('.image-error-message');
                if (existingError) {
                  existingError.remove();
                }
                const errorMsg = document.createElement('p');
                errorMsg.className = 'text-red-400 text-center image-error-message';
                errorMsg.textContent = 'Failed to load image. The file may be corrupted or in an unsupported format.';
                parent.appendChild(errorMsg);
              }
            }}
          />
          <p className="text-center text-gray-400 mt-2 text-sm">{tab.name}</p>
        </div>
      </div>
    );
  }

  // Handle PDFs
  if (tab.fileType === "pdf") {
    const pdfKey = `${tab.filePath}-${tab.fileContent?.length || 0}`;
    const pdfSizeMB = tab.fileContent ? (tab.fileContent.length * 0.75 / 1024 / 1024).toFixed(2) : '0';

    console.log(`[PDF] Rendering PDF: ${tab.filePath}`);
    console.log(`[PDF] Content length: ${tab.fileContent?.length || 0} chars`);
    console.log(`[PDF] Estimated size: ${pdfSizeMB} MB`);

    const handleDownloadPDF = () => {
      if (!tab.fileContent) return;

      // Create a blob from base64
      const byteCharacters = atob(tab.fileContent);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = tab.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    };

    return (
      <div className="h-full w-full bg-gray-900 relative flex flex-col" key={pdfKey}>
        <div className="p-2 bg-gray-800 text-gray-400 text-xs flex items-center justify-between">
          <span>PDF: {tab.name} (≈{pdfSizeMB} MB)</span>
          <button
            onClick={handleDownloadPDF}
            className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded"
          >
            Download PDF
          </button>
        </div>
        <iframe
          key={pdfKey}
          src={`data:application/pdf;base64,${tab.fileContent}`}
          className="w-full flex-1"
          title={tab.name}
          style={{ minHeight: '600px', border: 'none' }}
          onLoad={() => {
            console.log(`[PDF] Successfully loaded: ${tab.filePath}`);
          }}
          onError={() => {
            console.error('[PDF] Failed to load iframe:', tab.filePath);
          }}
        />
        <div className="p-4 bg-gray-800 text-center text-gray-400 text-sm">
          If the PDF doesn't display above, click "Download PDF" to view it locally.
        </div>
      </div>
    );
  }

  // Handle text files (existing logic)
  return renderFileContentWithLines(tab.fileContent);
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
  <div className={`${className} overflow-hidden`}>
    <div className="flex overflow-x-auto border-b border-gray-700 mb-2 bg-gray-900/40 px-2 flex-shrink-0">
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
    {activeTab?.filePath && (
      <div className="flex justify-end px-2 pb-2">
        <button
          type="button"
          className="px-3 py-1.5 text-xs sm:text-sm rounded-md border border-blue-400 text-blue-200 hover:bg-blue-500/10 disabled:opacity-60"
          onClick={() => onAssessActiveFile(activeTab.filePath!)}
          disabled={isAssessingFile || !canAssessFiles}
        >
          {isAssessingFile ? "Assessing..." : "Assess Security"}
        </button>
      </div>
    )}
    <div className="flex-1 overflow-y-auto overflow-x-auto bg-gray-900 p-0 rounded-md max-w-none min-h-0">
      {renderFileContent(activeTab)}
    </div>
  </div>
);

export default CodeViewer;

