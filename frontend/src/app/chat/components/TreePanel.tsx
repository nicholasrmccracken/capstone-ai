"use client";
import { memo, useMemo } from "react";
import type { FormEvent, MouseEvent, RefObject } from "react";
import type { TreeStructure, RepoDetails, Repository } from "../types";

interface TreePanelProps {
  className: string;
  url: string;
  onUrlChange: (value: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onClearRepositoriesClick: () => void;
  repositories: Repository[];
  selectedRepoId: string | null;
  onRepoSelect: (repoId: string) => void;
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

// Icon components
const ShieldIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const TrashIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const ClearIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const LoadingSpinner = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

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
  selectedRepoId,
  onRepoSelect,
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
          className="flex-1 p-2 border border-gray-600 bg-gray-800 text-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          className={`px-4 py-2 rounded-lg font-semibold transition-all ${
            effectiveHasApiKey || debugForceEnv
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "cursor-not-allowed bg-blue-600/40 text-blue-100/70"
          }`}
          disabled={!effectiveHasApiKey && !debugForceEnv}
        >
          Ingest
        </button>
      </form>
      {!isApiKeySet && !debugForceEnv && (
        <p className="mb-4 text-xs text-blue-100/80">
          Need a key?{" "}
          <button
            type="button"
            onClick={onManageApiKeyClick}
            className="underline decoration-dotted underline-offset-2 hover:text-blue-200"
          >
            Paste your OpenAI API key
          </button>{" "}
          to unlock ingest and chat.
        </p>
      )}

      {repositories.length > 0 && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Select Repository
          </label>
          <select
            value={selectedRepoId || ""}
            onChange={(e) => onRepoSelect(e.target.value)}
            className="w-full p-2 border border-gray-600 bg-gray-800 text-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="" disabled>
              Choose a repository...
            </option>
            {repositories.map((repo) => (
              <option key={repo.displayName} value={repo.displayName}>
                {repo.displayName}
              </option>
            ))}
          </select>
        </div>
      )}

      {repositories.length > 0 && (
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={onAssessRepoClick}
            className="flex-1 px-2 py-1.5 rounded-lg transition-all bg-slate-700 text-slate-100 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 border border-slate-600 hover:border-slate-500 disabled:border-slate-700"
            disabled={
              isAssessingRepo ||
              !effectiveHasApiKey ||
              !repoDetails.owner ||
              !repoDetails.repo
            }
            title={isAssessingRepo ? "Assessing security..." : "Assess Repo Security"}
          >
            {isAssessingRepo ? <LoadingSpinner className="w-3.5 h-3.5 flex-shrink-0" /> : <ShieldIcon className="w-3.5 h-3.5 flex-shrink-0" />}
            <span className="text-xs font-medium">Scan</span>
          </button>
          {selectedRepoId && (
            <button
              type="button"
              onClick={() => onDeleteRepository(selectedRepoId)}
              className="flex-1 px-2 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg transition-all flex items-center justify-center gap-1.5 border border-slate-600 hover:border-slate-500"
              title={`Delete ${selectedRepoId}`}
            >
              <TrashIcon className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="text-xs font-medium truncate">{selectedRepoId}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClearRepositoriesClick}
            className="flex-1 px-2 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg transition-all flex items-center justify-center gap-1.5 border border-slate-600 hover:border-slate-500"
            title="Clear all repositories from Elasticsearch"
          >
            <ClearIcon className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="text-xs font-medium whitespace-nowrap">Clear All</span>
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
