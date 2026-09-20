/**
 * Type definitions for the ZtoApi server
 */

/**
 * Request statistics interface
 * Tracks metrics for API calls
 */
export interface RequestStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  lastRequestTime: Date;
  averageResponseTime: number;
}

/**
 * Live request info for Dashboard display
 */
export interface LiveRequest {
  id: string;
  timestamp: Date;
  method: string;
  path: string;
  status: number;
  duration: number;
  userAgent: string;
  model?: string;
  tokens?: { prompt?: number; completion?: number; total?: number };
  error?: string;
}

/**
 * Chat message structure
 * Supports multimodal content: text, image, video, document, audio
 */
export interface Message {
  role: string;
  content:
    | string
    | Array<{
      type: string;
      text?: string;
      image_url?: { url: string };
      video_url?: { url: string };
      document_url?: { url: string };
      audio_url?: { url: string };
    }>;
  reasoning_content?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

/**
 * Tool function definition
 */
export interface ToolFunction {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

/**
 * Tool definition
 */
export interface Tool {
  type: "function";
  function: ToolFunction;
}

/**
 * Tool call in response
 */
export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * Tool result message
 */
export interface ToolResult {
  tool_call_id: string;
  role: "tool";
  content: string;
}

/**
 * OpenAI-compatible request structure for chat completions.
 */
export interface OpenAIRequest {
  model: string;
  messages: Message[];
  stream?: boolean;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stop?: string[];
  reasoning?: boolean;
  reasoning_effort?: "low" | "medium" | "high" | "max" | string;
  tools?: Tool[];
  tool_choice?: "none" | "auto" | "required" | { type: string; function: { name: string } } | string;
}

/**
 * Upstream request structure sent to Z.ai API.
 */
export interface UpstreamRequest {
  stream: boolean;
  model: string;
  messages: Message[];
  params?: Record<string, unknown>;
  features?: Record<string, unknown>;
  tools?: Tool[];
  tool_choice?: "none" | "auto" | "required" | { type: string; function: { name: string } } | string;
  enable_thinking?: boolean;
  reasoning_effort?: string;
  web_search?: boolean;
  background_tasks?: Record<string, boolean>;
  chat_id?: string;
  id?: string;
  mcp_servers?: string[];
  model_item?: {
    id: string;
    name: string;
    owned_by: string;
    openai?: Record<string, unknown>;
    urlIdx?: number;
    info?: Record<string, unknown>;
    actions?: Record<string, unknown>[];
    tags?: Record<string, unknown>[];
  };
  tool_servers?: string[];
  variables?: Record<string, string>;
  signature_prompt?: string;
}

/**
 * OpenAI-compatible response structure
 */
export interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Choice[];
  usage?: Usage;
}

export interface Choice {
  index: number;
  message?: Message;
  delta?: Delta;
  finish_reason?: string | null;
  tool_calls?: ToolCall[];
}

export interface Delta {
  role?: string;
  content?: string;
  reasoning_content?: string;
  tool_calls?: ToolCall[];
}

export interface Usage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

/**
 * Configuration for an MCP (Model Context Protocol) server.
 */
export interface MCPServerConfig {
  name: string;
  description: string;
  enabled: boolean;
}

/**
 * Capabilities of a model, indicating supported features.
 */
export interface ModelCapabilities {
  thinking: boolean;
  search: boolean;
  advancedSearch: boolean;
  vision: boolean;
  mcp: boolean;
  reasoningEffort?: boolean;
}

/**
 * Structure representing an uploaded file.
 */
export interface UploadedFile {
  id: string;
  filename: string;
  size: number;
  type: string;
  url: string;
}

/**
 * Upstream SSE data structure
 */
export interface UpstreamData {
  type: string;
  data: {
    delta_content: string;
    edit_content?: string;
    edit_index?: number;
    phase: string;
    done: boolean;
    usage?: Usage;
    error?: UpstreamError;
    inner?: {
      error?: UpstreamError;
    };
  };
  error?: UpstreamError;
}

export interface UpstreamError {
  detail: string;
  code: number;
}

export interface ModelsResponse {
  object: string;
  data: Model[];
}

export interface Model {
  id: string;
  object: string;
  created: number;
  owned_by: string;
  context_window?: number;
  max_output_tokens?: number;
}

/**
 * Supported model configuration
 */
export interface ModelConfig {
  id: string;
  name: string;
  upstreamId: string;
  contextWindow?: number;
  capabilities: ModelCapabilities;
  defaultParams: {
    top_p: number;
    temperature: number;
    max_tokens?: number;
  };
}

/**
 * Token information for token pool management
 */
export interface TokenInfo {
  token: string;
  isValid: boolean;
  lastUsed: number;
  failureCount: number;
  isAnonymous: boolean;
}

export const THINK_TAGS_MODE = "think";
