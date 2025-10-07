import type { TreeStructure } from "../types";

export const getAllDirectoryPaths = (
  structure: TreeStructure,
  parentPath: string[] = []
): string[] => {
  let paths: string[] = [];

  for (const [name, value] of Object.entries(structure)) {
    if (value && typeof value === "object") {
      const currentPath = [...parentPath, name];
      paths.push(currentPath.join("/"));
      paths = paths.concat(getAllDirectoryPaths(value as TreeStructure, currentPath));
    }
  }

  return paths;
};

export const getAllFilePaths = (
  structure: TreeStructure,
  parentPath: string[] = []
): string[] => {
  let paths: string[] = [];

  for (const [name, value] of Object.entries(structure)) {
    const currentPath = [...parentPath, name];
    const fullPath = currentPath.join("/");

    if (value && typeof value === "object") {
      paths = paths.concat(getAllFilePaths(value as TreeStructure, currentPath));
    } else {
      paths.push(fullPath);
    }
  }

  return paths;
};
