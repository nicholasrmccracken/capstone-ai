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
}

export interface RepoDetails {
  owner: string;
  repo: string;
  defaultBranch: string;
}
