/**
 * Model configuration and capabilities
 */

import { normalizeModelId } from "../utils/helpers.ts";
import { logger } from "../utils/logger.ts";
import type { ModelCapabilities } from "../types/definitions.ts";

/**
 * Model configuration interface
 */
export interface ModelConfig {
  id: string; // Model ID as exposed by API
  name: string; // Display name
  upstreamId: string; // Upstream Z.ai model ID
  contextWindow?: number; // Context window in tokens (e.g., 1,000,000 for 1M)
  capabilities: ModelCapabilities;
  defaultParams: {
    top_p: number;
    temperature: number;
    max_tokens?: number;
  };
}

/**
 * Supported models configuration based on live Z.ai models
 */
export const SUPPORTED_MODELS: ModelConfig[] = [
  {
    id: "GLM-5.3-Flash",
    name: "GLM-5.3-Flash",
    upstreamId: "x-preview-l",
    contextWindow: 1000000, // 1M tokens
    capabilities: {
      vision: true,
      mcp: true,
      thinking: true,
      search: true,
      advancedSearch: false,
      reasoningEffort: true,
    },
    defaultParams: {
      top_p: 0.95,
      temperature: 1.0,
      max_tokens: 128000,
    },
  },
  {
    id: "GLM-5.3",
    name: "GLM-5.3",
    upstreamId: "glm-5.3",
    contextWindow: 1000000, // 1M tokens
    capabilities: {
      vision: false,
      mcp: true,
      thinking: true,
      search: true,
      advancedSearch: false,
      reasoningEffort: true,
    },
    defaultParams: {
      top_p: 0.95,
      temperature: 1.0,
      max_tokens: 128000,
    },
  },
  {
    id: "GLM-5.2",
    name: "GLM-5.2",
    upstreamId: "glm-5.2",
    contextWindow: 1000000, // 1M tokens
    capabilities: {
      vision: false,
      mcp: true,
      thinking: true,
      search: true,
      advancedSearch: false,
      reasoningEffort: true,
    },
    defaultParams: {
      top_p: 0.95,
      temperature: 1.0,
      max_tokens: 64064,
    },
  },
];

// Default model is the latest flagship: GLM-5.3-Flash
export const DEFAULT_MODEL = SUPPORTED_MODELS[0];

const MODEL_ALIASES: Record<string, string> = {
  "x-preview-l": "GLM-5.3-Flash",
  "glm-5.3-flash": "GLM-5.3-Flash",
  "glm-5-3-flash": "GLM-5.3-Flash",
  "glm-5.3": "GLM-5.3",
  "glm-5-3": "GLM-5.3",
  "glm-5.2": "GLM-5.2",
  "glm-5-2": "GLM-5.2",
  "glm-5": "GLM-5.3",
  "glm": "GLM-5.3-Flash",
};

/**
 * Get model configuration by ID
 */
export function getModelConfig(modelId: string): ModelConfig {
  const normalized = normalizeModelId(modelId);

  // 1. Direct match on ID
  let found = SUPPORTED_MODELS.find((m) => m.id.toLowerCase() === normalized);

  // 2. Direct match on Upstream ID
  if (!found) {
    found = SUPPORTED_MODELS.find((m) => m.upstreamId.toLowerCase() === normalized);
  }

  // 3. Match via known aliases
  if (!found) {
    const aliasTarget = MODEL_ALIASES[normalized];
    if (aliasTarget) {
      found = SUPPORTED_MODELS.find((m) => m.id.toLowerCase() === aliasTarget.toLowerCase());
    }
  }

  if (!found) {
    logger.warn(
      "Model config not found: %s (normalized: %s). Using default: %s",
      modelId,
      normalized,
      DEFAULT_MODEL.name,
    );
  }

  return found || DEFAULT_MODEL;
}

/**
 * Map model ID (handle special cases to upstream model IDs)
 */
export function mapModelId(modelId: string): string {
  const config = getModelConfig(modelId);
  return config.upstreamId;
}
