/**
 * Validation utilities
 * Contains message processing functions for multimodal content
 */

import type { Message } from "../types/definitions.ts";
import type { ModelConfig } from "../config/models.ts";
import { debugLog } from "./logger.ts";

/**
 * Process and validate multimodal messages
 * Supports image, video, document, audio types
 */
export function processMessages(messages: Message[], modelConfig: ModelConfig): Message[] {
  const processedMessages: Message[] = [];

  for (const message of messages) {
    const processedMessage: Message = { ...message };

    if (Array.isArray(message.content)) {
      debugLog("Detected multimodal message, blocks: %d", message.content.length);

      if (!modelConfig.capabilities.vision) {
        debugLog("Warning: Model %s does not support multimodal content, filtering to text", modelConfig.name);
        const textContent = message.content
          .filter((block) => block.type === "text")
          .map((block) => block.text)
          .join("\n");
        processedMessage.content = textContent;
      }
    } else if (typeof message.content === "string") {
      debugLog("Plain text message, length: %d", message.content.length);
    }

    processedMessages.push(processedMessage);
  }

  return processedMessages;
}
