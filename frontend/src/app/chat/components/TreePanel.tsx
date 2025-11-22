"use client";
import { memo, useMemo } from "react";
import type { FormEvent, MouseEvent, RefObject } from "react";
import type { TreeStructure, RepoDetails, Repository } from "../types";
import { Folder, FolderOpen, FileText, ChevronRight, ChevronDown, Trash2, RefreshCw, Key, ShieldAlert, Search } from "lucide-react";

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

interface TreeNodeProps {
  structure: TreeStructure;
  parentPath: string[];
  expandedNodes: Set<string>;
  selectedItems: string[];
  fileColors: Map<string, string>;
  onFolderClick: (name: string, parentPath: string[], e: MouseEvent) => void;
  onFileClick: (name: string, parentPath: string[], e: MouseEvent) => void;
  level?: number;
}

const TreeNode = memo(
  ({
    structure,
    parentPath,
    expandedNodes,
    selectedItems,
    fileColors,
    onFolderClick,
    onFileClick,
    level = 0,
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
        {entries.map(([name, value]) => {
          const isDirectory = typeof value === "object" && value !== null;
          const itemPath = [...parentPath, name].join("/");
          const isExpanded = expandedNodes.has(itemPath);
          const isSelected = selectedItems.includes(itemPath);
          const fileColor = fileColors.get(itemPath);

          return (
            <div key={itemPath}>
              <div
                className={`
                  flex items-center gap-1.5 py-1 px-2 cursor-pointer select-none transition-colors text-sm
                  ${isSelected ? "bg-blue-600/20 text-blue-300" : "text-gray-400 hover:bg-white/5 hover:text-gray-200"}
                `}
                style={{ paddingLeft: `${level * 12 + 8}px` }}
                onClick={(event) => {
                  if (isDirectory) {
                    onFolderClick(name, parentPath, event);
                  } else {
                    onFileClick(name, parentPath, event);
                  }
                }}
              >
                {isDirectory ? (
                  <>
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    {isExpanded ? <FolderOpen size={14} className="text-blue-400" /> : <Folder size={14} className="text-blue-400" />}
                  </>
                ) : (
                  <>
                    <span className="w-3.5" /> {/* Spacer for alignment */}
                    <FileText size={14} className={fileColor ? `text-${fileColor}-400` : "text-gray-500"} />
                  </>
                )}
                <span className="truncate">{name}</span>
              </div>

              {isDirectory && isExpanded && (
                <TreeNode
                  structure={value as TreeStructure}
                  parentPath={[...parentPath, name]}
                  expandedNodes={expandedNodes}
                  selectedItems={selectedItems}
                  fileColors={fileColors}
                  onFolderClick={onFolderClick}
                  onFileClick={onFileClick}
                  level={level + 1}
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
    <div className={`${className} flex flex-col bg-[#1e1e1e]/50 backdrop-blur-sm`}>
      <div className="p-4 space-y-4">
        {/* API Key Warning */}
        {!effectiveHasApiKey && !debugForceEnv && (
          <div className="flex items-start gap-3 rounded-xl border border-blue-500/20 bg-blue-500/10 p-3">
            <Key className="text-blue-400 mt-0.5" size={18} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-blue-200">
                API Key Required
              </p>
              <p className="mt-1 text-xs text-blue-300/80 leading-relaxed">
                Add your OpenAI API key to analyze repositories.
              </p>
              <button
                type="button"
                onClick={onManageApiKeyClick}
                className="mt-2 text-xs font-semibold text-blue-300 hover:text-white underline decoration-dotted underline-offset-2"
              >
                Add Key Now
              </button>
            </div>
          </div>
        )}

        {/* Repo Input */}
        <form onSubmit={onSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={url}
              onChange={(event) => onUrlChange(event.target.value)}
              placeholder="GitHub URL..."
              className="w-full py-2 pl-9 pr-3 bg-black/20 border border-white/10 text-white text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 placeholder-gray-500"
            />
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-500" size={14} />
          </div>
          <button
            type="submit"
            className={`px-3 py-2 rounded-lg font-medium text-sm transition-all flex items-center justify-center ${effectiveHasApiKey || debugForceEnv
              ? "bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-500/20"
              : "bg-gray-700 text-gray-400 cursor-not-allowed"
              }`}
            disabled={!effectiveHasApiKey && !debugForceEnv}
          >
            Ingest
          </button>
        </form>

        {/* Actions */}
        <button
          type="button"
          onClick={onAssessRepoClick}
          className="w-full py-2 px-3 rounded-lg font-medium text-sm transition-all bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={
            isAssessingRepo ||
            !effectiveHasApiKey ||
            !repoDetails.owner ||
            !repoDetails.repo
          }
        >
          <ShieldAlert size={14} />
          {isAssessingRepo ? "Assessing..." : "Assess Security"}
        </button>

        {/* Repo Selection */}
        {repositories.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-white/5">
            <select
              value={selectedRepoId || ""}
              onChange={(e) => onRepoSelect(e.target.value)}
              className="w-full p-2 bg-black/20 border border-white/10 text-white text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            >
              <option value="" disabled>Select Repository...</option>
              {repositories.map((repo) => (
                <option key={repo.displayName} value={repo.displayName}>
                  {repo.displayName}
                </option>
              ))}
            </select>

            <div className="flex gap-2">
              {selectedRepoId && (
                <button
                  type="button"
                  onClick={() => onDeleteRepository(selectedRepoId)}
                  className="flex-1 py-1.5 px-2 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1"
                  title={`Delete ${selectedRepoId}`}
                >
                  <Trash2 size={12} />
                  Delete
                </button>
              )}
              <button
                type="button"
                onClick={onClearRepositoriesClick}
                className="flex-1 py-1.5 px-2 bg-gray-700/30 text-gray-400 border border-gray-600/30 hover:bg-gray-700/50 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1"
              >
                <RefreshCw size={12} />
                Clear All
              </button>
            </div>
          </div>
        )}
      </div>

      {/* File Tree */}
      <div className="flex items-center justify-between px-4 pb-2 border-b border-white/5">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Explorer
        </h3>
        {treeStructure && hasDirectories && (
          <button
            type="button"
            onClick={onToggleExpandAll}
            className="text-xs text-gray-500 hover:text-white transition-colors"
            title={isFullyExpanded ? "Collapse All" : "Expand All"}
          >
            {isFullyExpanded ? "Collapse" : "Expand"}
          </button>
        )}
      </div>

      <div
        ref={treeContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden py-2"
      >
        {isLoadingTree && (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mb-2"></div>
            <span className="text-xs">Loading tree...</span>
          </div>
        )}

        {treeError && (
          <div className="p-4 text-center">
            <p className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">
              {treeError}
            </p>
          </div>
        )}

        {treeStructure && (
          <div className="min-w-full">
            {treeCurrentPath.length > 0 && (
              <button
                type="button"
                onClick={onTreeBackClick}
                className="w-full text-left px-4 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-white/5 flex items-center gap-2"
              >
                <ChevronDown size={14} className="rotate-90" />
                ..
              </button>
            )}

            {/* Root Node */}
            <div className="px-4 py-1.5 text-sm font-medium text-gray-200 flex items-center gap-2 select-none">
              <FolderOpen size={14} className="text-blue-400" />
              {rootName}
            </div>

            <TreeNode
              structure={currentStructure}
              parentPath={treeCurrentPath}
              expandedNodes={expandedNodes}
              selectedItems={selectedItems}
              fileColors={fileColors}
              onFolderClick={onFolderClick}
              onFileClick={onFileClick}
              level={1}
            />
          </div>
        )}

        {!isLoadingTree && !treeError && !treeStructure && (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center text-gray-500">
            <Search size={32} className="mb-3 opacity-20" />
            <p className="text-sm">Enter a repository URL to explore its structure.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TreePanel;
