export interface TreeStructure {
  [key: string]: TreeStructure | string;
}

export interface Message {
  sender: string;
  text: string;
  sourceFiles: string[];
}

export interface Tab {
  id: number;
  name: string;
  color: string;
  filePath: string | null;
  fileContent: string | null;
  fileType?: "text" | "image" | "pdf";
  contentType?: string;
}

export interface RepoDetails {
  owner: string;
  repo: string;
  defaultBranch: string;
}

export interface Repository {
  owner: string;
  repo: string;
  defaultBranch: string;
  url: string;
  displayName: string; // Format: "owner/repo"
}
