"use client";
import { memo, useMemo } from "react";
import type { FormEvent, MouseEvent, RefObject } from "react";
import type { TreeStructure, RepoDetails } from "../types";

interface TreePanelProps {
  className: string;
  url: string;
  onUrlChange: (value: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
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
  onFolderClick: (name: string, parentPath: string[], e: MouseEvent) => void;
  onFileClick: (name: string, parentPath: string[], e: MouseEvent) => void;
  onToggleExpandAll: () => void;
  hasDirectories: boolean;
  isFullyExpanded: boolean;
  treeContainerRef: RefObject<HTMLDivElement>;
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

const INDENT_WITH_BRANCH = "|  ";
const INDENT_WITHOUT_BRANCH = "   ";

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
          const connector = `${prefix}${isLast ? "`--" : "|--"}`;

          const itemPath = [...parentPath, name].join("/");
          const isExpanded = expandedNodes.has(itemPath);
          const isSelected = selectedItems.includes(itemPath);
          const fileColor = fileColors.get(itemPath);

          return (
            <div key={itemPath}>
              <div className="flex items-center space-x-2">
                <span className="text-gray-500 select-none">{connector}</span>
                {isDirectory ? (
                  <button
                    type="button"
                    onClick={(event) => onFolderClick(name, parentPath, event)}
                    className={`text-left font-mono hover:underline ${
                      isSelected ? "bg-blue-600 text-blue-200 px-1 rounded" : "text-blue-400"
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
                  prefix={prefix + (isLast ? INDENT_WITHOUT_BRANCH : INDENT_WITH_BRANCH)}
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
}: TreePanelProps) => {
  const rootName =
    treeCurrentPath.length === 0 ? repoDetails.repo : treeCurrentPath[treeCurrentPath.length - 1];

  return (
    <div className={className}>
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
          className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all"
        >
          Send
        </button>
      </form>

      <div className="mb-4">
        <button
          type="button"
          onClick={onClearRepositoriesClick}
          className="w-full px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
          title="Clear all repositories from Elasticsearch"
        >
          Clear Repositories
        </button>
      </div>

      <div className="flex justify-between items-center mb-2">
        <h3 className="text-xl font-bold text-gray-300">Repository Structure</h3>
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

      <div ref={treeContainerRef} className="flex-1 overflow-auto bg-gray-900 p-2 rounded-md">
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
            <div className="text-sm text-gray-300 font-mono">
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
          <p className="text-gray-500">Enter a repository URL to see its structure here.</p>
        )}
      </div>
    </div>
  );
};

export default TreePanel;


