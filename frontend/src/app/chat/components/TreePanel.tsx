"use client";
import { memo, useMemo, useState, useRef, useEffect } from "react";
import type { FormEvent, MouseEvent, RefObject } from "react";
import type { TreeStructure, RepoDetails, Repository } from "../types";

interface TreePanelProps {
  className: string;
  url: string;
  onUrlChange: (value: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onClearRepositoriesClick: () => void;
  repositories: Repository[];
  selectedRepoIds: string[];
  onRepoToggle: (repoId: string) => void;
  onDeleteRepository: (repoId: string) => void;
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
  onFolderClick: (name: string, parentPath: string[], e: MouseEvent) => void;
  onFileClick: (name: string, parentPath: string[], e: MouseEvent) => void;
  onToggleExpandAll: () => void;
  hasDirectories: boolean;
  isFullyExpanded: boolean;
  treeContainerRef: RefObject<HTMLDivElement | null>;
  isApiKeySet: boolean;
  effectiveHasApiKey: boolean;
  onManageApiKeyClick: () => void;
  debugForceEnv: boolean;
  onAssessRepoClick: () => void;
  isAssessingRepo: boolean;
}

interface TreeNodeProps {
  structure: TreeStructure;
  parentPath: string[];
  prefix?: string;
  expandedNodes: Set<string>;
  selectedItems: string[];
  fileColors: Map<string, string>;
  onFolderClick: (name: string, parentPath: string[], e: MouseEvent) => void;
  onFileClick: (name: string, parentPath: string[], e: MouseEvent) => void;
}

// Use non-breaking spaces for consistent monospace alignment
const NBSP = "\u00A0";
const INDENT_WITH_BRANCH = `│${NBSP}${NBSP}${NBSP}`;
const INDENT_WITHOUT_BRANCH = `${NBSP}${NBSP}${NBSP}${NBSP}`;

const TreeNode = memo(
  ({
    structure,
    parentPath,
    prefix = "",
    expandedNodes,
    selectedItems,
    fileColors,
    onFolderClick,
    onFileClick,
  }: TreeNodeProps) => {
    const entries = useMemo(
      () =>
        Object.entries(structure).sort((a, b) => {
          const aIsDir = typeof a[1] === "object" && a[1] !== null;
          const bIsDir = typeof b[1] === "object" && b[1] !== null;
          if (aIsDir && !bIsDir) return -1;
          if (!aIsDir && bIsDir) return 1;
          return a[0].localeCompare(b[0]);
        }),
      [structure]
    );

    return (
      <>
        {entries.map(([name, value], index) => {
          const isDirectory = typeof value === "object" && value !== null;
          const isLast = index === entries.length - 1;
          const connector = `${prefix}${isLast ? "└── " : "├── "}`;

          const itemPath = [...parentPath, name].join("/");
          const isExpanded = expandedNodes.has(itemPath);
          const isSelected = selectedItems.includes(itemPath);
          const fileColor = fileColors.get(itemPath);

          return (
            <div key={itemPath} className="font-mono whitespace-pre leading-5">
              <div className="flex items-center space-x-2">
                <span
                  className="text-gray-500 select-none inline-block"
                  style={{
                    whiteSpace: "pre",
                    fontFamily: "monospace",
                    display: "inline-block",
                    textShadow: "0.5px 0 0 currentColor, -0.5px 0 0 currentColor, 0 0.5px 0 currentColor",
                  }}
                >
                  {connector}
                </span>
                {isDirectory ? (
                  <button
                    type="button"
                    onClick={(event) => onFolderClick(name, parentPath, event)}
                    className={`text-left font-mono hover:underline ${
                      isSelected
                        ? "bg-blue-600 text-blue-200 px-1 rounded"
                        : "text-blue-400"
                    }`}
                  >
                    {name}/ {isExpanded ? "[-]" : "[+]"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(event) => onFileClick(name, parentPath, event)}
                    className={`text-left font-mono hover:underline ${
                      isSelected ? "bg-yellow-600 text-white px-1 rounded" : ""
                    } ${fileColor ? `text-${fileColor}-400` : ""}`}
                    data-file-path={itemPath}
                  >
                    {name}
                  </button>
                )}
              </div>
              {isDirectory && isExpanded && (
                <TreeNode
                  structure={value as TreeStructure}
                  parentPath={[...parentPath, name]}
                  prefix={
                    prefix + (isLast ? INDENT_WITHOUT_BRANCH : INDENT_WITH_BRANCH)
                  }
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
  }
);

TreeNode.displayName = "TreeNode";

const TreePanel = ({
  url,
  onUrlChange,
  onSubmit,
  onClearRepositoriesClick,
  repositories,
  selectedRepoIds,
  onRepoToggle,
  onDeleteRepository,
  treeStructure,
  treeError,
  isLoadingTree,
  treeCurrentPath,
  onTreeBackClick,
  currentStructure,
  repoDetails,
  expandedNodes,
  selectedItems,
  fileColors,
  onFolderClick,
  onFileClick,
  onToggleExpandAll,
  hasDirectories,
  isFullyExpanded,
  treeContainerRef,
  className,
  isApiKeySet,
  effectiveHasApiKey,
  onManageApiKeyClick,
  debugForceEnv,
  onAssessRepoClick,
  isAssessingRepo,
}: TreePanelProps) => {
  const rootName =
    treeCurrentPath.length === 0
      ? repoDetails.repo
      : treeCurrentPath[treeCurrentPath.length - 1];

  const [showRepoSelector, setShowRepoSelector] = useState(false);
  const selectorRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      if (selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
        setShowRepoSelector(false);
      }
    };

    if (showRepoSelector) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showRepoSelector]);

  return (
    <div className={className}>
      {!effectiveHasApiKey && !debugForceEnv && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-blue-500/40 bg-blue-900/20 px-4 py-3">
          <span className="text-2xl leading-none">🔑</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-100">
              Add your OpenAI API key to get started
            </p>
            <p className="mt-1 text-xs text-blue-100/80">
              Your key is saved locally in this browser and used only for
              repository ingestion and chat responses.
            </p>
          </div>
          <button
            type="button"
            onClick={onManageApiKeyClick}
            className="rounded-lg border border-blue-400/40 px-3 py-1.5 text-sm font-semibold text-blue-100 transition-colors hover:border-blue-300 hover:bg-blue-500/20"
          >
            Add Key
          </button>
        </div>
      )}

      <form onSubmit={onSubmit} className="flex gap-2 mb-4">
        <input
          type="text"
          value={url}
          onChange={(event) => onUrlChange(event.target.value)}
          placeholder="Enter a GitHub repository URL"
          className="flex-1 p-3 border border-gray-600 bg-gray-800 text-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          className={`px-5 py-3 rounded-lg font-semibold transition-all ${
            effectiveHasApiKey || debugForceEnv
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "cursor-not-allowed bg-blue-600/40 text-blue-100/70"
          }`}
          disabled={!effectiveHasApiKey && !debugForceEnv}
        >
          Ingest Repo
        </button>
      </form>

      {repositories.length > 0 && (
        <div className="mb-4 relative" ref={selectorRef}>
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-300">
              Selected Repositories ({selectedRepoIds.length})
            </label>
            <button
              type="button"
              onClick={() => setShowRepoSelector(!showRepoSelector)}
              className="text-xs text-gray-400 hover:text-gray-300 transition-colors"
            >
              {showRepoSelector ? 'Collapse' : 'Select...'}
            </button>
          </div>

          <div className="mt-2 min-h-[3rem] relative">
            <div className="flex flex-wrap gap-2 min-h-[2.5rem] p-2 border border-gray-600 bg-gray-800 rounded-lg">
              {selectedRepoIds.length > 0 ? (
                selectedRepoIds.map((repoId) => {
                  const repo = repositories.find(r => r.displayName === repoId);
                  return (
                    <span
                      key={repoId}
                      className="inline-flex items-center gap-1 bg-blue-600 text-white px-2 py-1 rounded text-xs"
                    >
                      <span className="truncate max-w-32">{repo?.displayName || repoId}</span>
                      <button
                        type="button"
                        onClick={() => onRepoToggle(repoId)}
                        className="hover:text-red-300 ml-1"
                        title={`Remove ${repoId}`}
                      >
                        ×
                      </button>
                    </span>
                  );
                })
              ) : (
                <span className="text-gray-500 text-sm">No repositories selected</span>
              )}
            </div>

            {showRepoSelector && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                <div className="p-2 space-y-1">
                  {repositories.map((repo) => (
                    <label
                      key={repo.displayName}
                      className="flex items-center cursor-pointer hover:bg-gray-700 p-2 rounded text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selectedRepoIds.includes(repo.displayName)}
                        onChange={() => onRepoToggle(repo.displayName)}
                        className="mr-3 h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                      />
                      <span className="text-gray-200 truncate">{repo.displayName}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {repositories.length > 0 && selectedRepoIds.length > 0 && (
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => {
              const repoId = selectedRepoIds[0]; // For now, if multiple are selected, use the first one for delete buttons
              onDeleteRepository(repoId);
            }}
            className="flex-1 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition-all text-xs sm:text-sm truncate"
            title={`Delete ${selectedRepoIds[0]}`}
            disabled={selectedRepoIds.length > 1}
          >
            Delete {(selectedRepoIds.length <= 1) && selectedRepoIds[0]}
          </button>
          <button
            type="button"
            onClick={onClearRepositoriesClick}
            className="flex-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition-all text-xs sm:text-sm whitespace-nowrap"
            title="Clear all repositories from Elasticsearch"
          >
            Clear All
          </button>
        </div>
      )}

      <div className="flex justify-between items-center mb-2">
        <h3 className="text-xl font-bold text-gray-300">
          Repository Structure
        </h3>
        {treeStructure && hasDirectories && (
          <button
            type="button"
            onClick={onToggleExpandAll}
            className="font-mono text-lg text-gray-400 hover:text-white px-2"
            title="Toggle Expand/Collapse All"
          >
            {isFullyExpanded ? "[-]" : "[+]"}
          </button>
        )}
      </div>

      <div
        ref={treeContainerRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-auto bg-gray-900 p-2 rounded-md scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#4B5563 #1F2937'
        }}
      >
        {isLoadingTree && <p className="text-gray-400">Loading tree...</p>}
        {treeError && <p className="text-red-400">{treeError}</p>}
        {treeStructure && (
          <>
            {treeCurrentPath.length > 0 && (
              <div className="mb-4">
                <button
                  type="button"
                  onClick={onTreeBackClick}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
                >
                  Back
                </button>
              </div>
            )}
            <div className="text-sm text-gray-300 font-mono whitespace-pre">
              <div className="mb-1">
                <span>{rootName}</span>
              </div>
              <TreeNode
                structure={currentStructure}
                parentPath={treeCurrentPath}
                expandedNodes={expandedNodes}
                selectedItems={selectedItems}
                fileColors={fileColors}
                onFolderClick={onFolderClick}
                onFileClick={onFileClick}
              />
            </div>
          </>
        )}
        {!isLoadingTree && !treeError && !treeStructure && (
          <p className="text-gray-500">
            Enter a repository URL to see its structure here.
          </p>
        )}
      </div>
    </div>
  );
};

export default TreePanel;
