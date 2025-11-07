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

export type SecuritySeverity = "critical" | "high" | "medium" | "low" | "info";

export interface SecurityFinding {
  severity: SecuritySeverity | string;
  title: string;
  description: string;
  file_path?: string;
  line_hints?: string;
  evidence?: string;
  remediation?: string;
  category?: string;
}

export interface SecurityAssessment {
  scope: "repo" | "file";
  owner: string;
  repo: string;
  summary: string;
  findings: SecurityFinding[];
  file_path?: string;
  sampled_files?: string[];
  ran_at: string;
  context_source?: string;
}
