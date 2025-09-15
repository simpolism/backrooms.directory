export interface ModelInfo {
  api_name: string;
  display_name: string;
  company: string;
  is_custom_selector?: boolean; // New flag to identify special entries
}

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface TemplateConfig {
  system_prompt: string;
  context: Message[];
}

export interface ApiClients {
  openai?: any;
}

export interface ConversationOptions {
  models: string[];
  template: string;
  maxTurns: number;
}

export interface ApiKeys {
  hyperbolicApiKey: string;
  openrouterApiKey: string;
}

// Callback function type for streaming content updates
export type StreamingCallback = (chunk: string, isDone: boolean) => void;

// Explore mode settings for a model
export interface ExploreModeSetting {
  enabled: boolean;     // Whether explore mode is enabled for this model
  numRequests: number;  // Number of parallel requests (n) for this model
}

// Map of model position to explore mode settings
export type ExploreModeSettings = Record<number, ExploreModeSetting>;

// Interface for tracking parallel responses in explore mode
export interface ParallelResponse {
  id: string;           // Unique ID for this response
  content: string;      // Current accumulated content
  isSelected: boolean;  // Whether this response has been selected by the user
  isComplete: boolean;  // Whether this response is complete
  usage?: UsageData;    // Usage data for this response
}

// Selection callback for explore mode
export type SelectionCallback = (responseId: string) => void;

// Extended streaming callback that includes response ID
export type ExploreStreamingCallback = (responseId: string, chunk: string, isDone: boolean) => void;

export interface CustomTemplate {
  name: string;        // Display name for the template
  description: string; // Brief description of what the template does
  content: string;     // Raw JSONL content
  originalName?: string; // Name of original template if this is based on an existing one
  lastModified: number; // Timestamp
}

// Usage data for token counting and cost tracking
export interface UsageData {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost?: number; // Optional, calculated differently per provider
}

// Response from model including content and usage data
export interface ModelResponse {
  content: string;
  usage: UsageData;
  generationId?: string; // For OpenRouter cost lookup
}

// Cumulative usage tracking for the entire conversation
export interface ConversationUsage {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCost: number;
  modelBreakdown: Record<string, UsageData>; // Model display name -> usage
}