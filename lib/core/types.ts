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

export interface IngestResult {
  title: string;
  markdown: string;
  filePath: string;
  pageId: string;
  spaceKey: string;
  version: number;
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
