// ---------------------------------------------------------------------------
// Shared types for PRD Review Tool (used by both Web API and CLI)
// ---------------------------------------------------------------------------

export interface LLMSettings {
  provider: 'openai' | 'anthropic' | 'gemini' | 'openrouter' | 'local' | 'mock';
  model: string;
  apiKey: string;
  baseURL?: string;
}

export interface ReviewQuestion {
  text: string;
  priority: 'low' | 'medium' | 'high';
}

export interface AnsweredQuestion {
  text: string;
  answer: string;
  priority: 'low' | 'medium' | 'high';
  isAiGenerated: boolean;
}

// The method the user chose to provide the PRD
export type PRDSourceMethod =
  | 'confluence'
  | 'upload'
  | 'repo-local'
  | 'repo-azure-devops'
  | 'demo';

// Source-specific metadata (discriminated union)
export type PRDSourceMetadata =
  | { method: 'confluence'; spaceKey: string; version: number; confluencePageId: string }
  | { method: 'upload'; originalFileName: string }
  | { method: 'repo-local'; repoPath: string; filePathInRepo: string }
  | {
      method: 'repo-azure-devops';
      org: string;
      project: string;
      repoName: string;
      filePath: string;
      branch: string;
    }
  | { method: 'demo' };

// Unified ingestion result
export interface IngestResult {
  title: string;
  markdown: string;
  stagedFilePath: string; // path to the staged .md in prds/
  pageId: string; // unique session identifier (kept for URL routing / session keys)
  source: PRDSourceMetadata;
}

// Repo context for swarm evaluation — tracks where the code lives
export interface RepoContext {
  type: 'local' | 'azure-devops';
  label: string; // human-readable label for the UI
  localPath?: string; // for local repos
  org?: string; // for Azure DevOps
  project?: string;
  repoName?: string;
  pat?: string; // transient, never stored server-side
}

export interface PBIData {
  description: string;
  functionalReqs: string;
  gherkin: string;
}

export interface AgentFeedback {
  agentName: string;
  role: string;
  feedback: string;
}

export interface EnhancedPBI extends PBIData {
  agentReviews: AgentFeedback[];
}

export interface AzureConfig {
  org: string;
  project: string;
  pat: string;
  demo?: boolean;
}

export interface ExportResult {
  success: boolean;
  url?: string;
  message?: string;
}

export interface PRDReviewConfig {
  provider?: LLMSettings['provider'];
  model?: string;
  apiKey?: string;
  baseURL?: string;
  codebasePath?: string;
  azure?: {
    org?: string;
    project?: string;
    pat?: string;
  };
  customPrompts?: Record<string, string>;
}

export interface SessionState {
  pageId: string;
  markdown: string;
  title: string;
  qaQuestions: AnsweredQuestion[];
  engQuestions: AnsweredQuestion[];
  designQuestions: AnsweredQuestion[];
  teamNotes: string;
  breakdown: string;
  pbis: EnhancedPBI[];
}
