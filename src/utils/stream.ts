/**
 * Stream processing utilities
 * Handles SSE stream parsing and transformation
 * Provides advanced thinking mode handling with state tracking
 */

import { logger } from "./logger.ts";
import type { UpstreamData, Usage } from "../types/definitions.ts";

// Thinking content handling mode:
// - "strip": remove <details> tags and show only content
// - "thinking": convert <details> to <thinking> tags
// - "think": convert <details> to <think> tags
// - "raw": keep as-is
// - "separate": separate reasoning into reasoning_content field
const THINK_TAGS_MODE = "think";

/**
 * Transforms thinking content based on the specified mode.
 * Returns either a string (for "strip", "thinking", "think", "raw" modes) or an object with reasoning and content (for "separate" mode).
 * @param {string} content - The content to transform, containing thinking tags.
 * @param {"strip" | "thinking" | "think" | "raw" | "separate"} [mode=THINK_TAGS_MODE] - The transformation mode.
 * @returns {string | { reasoning: string; content: string }} The transformed content.
 */
export function transformThinking(
  content: string,
  mode: "strip" | "thinking" | "think" | "raw" | "separate" = THINK_TAGS_MODE as
    | "strip"
    | "thinking"
    | "think"
    | "raw"
    | "separate",
): string | { reasoning: string; content: string } {
  // Raw mode: return as-is
  if (mode === "raw") {
    return content;
  }

  // Separate mode: extract reasoning and content separately
  if (mode === "separate") {
    let reasoning = "";
    let finalContent = "";

    // Check for <think>...</think> format first (for test compatibility)
    if (content.includes("</think>")) {
      // Match <think>...</think> blocks - check for the specific format used in tests
      const isParenThinkFormat = content.includes("<think>");
      let thinkBlocks: string[] = [];

      if (isParenThinkFormat) {
        // Extract <think>...</think> blocks
        const parenMatch = content.match(/<think[^>]*>(.*?)<\/think>/gs);
        if (parenMatch) {
          thinkBlocks = parenMatch;
        }
      } else {
        const thinkingMatch = content.match(/<thinking[^>]*>(.*?)<\/thinking>/gs);
        if (thinkingMatch) {
          thinkBlocks = thinkingMatch;
        }
      }

      if (thinkBlocks) {
        // Process reasoning content
        reasoning = thinkBlocks.join("\n");

        // Remove <thinking>...</thinking> and <think>...</think> tags
        reasoning = reasoning.replace(/<\/?(think|thinking)[^>]*>/g, "").trim();

        // Extract final content (everything outside <think>...</think> tags)
        finalContent = content.replace(/<thinking[^>]*>.*?<\/thinking>/gs, "").replace(
          /<think[^>]*>.*?<\/think>/gs,
          "",
        );
      } else {
        finalContent = content;
      }
    } else {
      // Try standard regex first (for complete <details> tags)
      const detailsMatch = content.match(/<details[^>]*>(.*?)<\/details>/gs);

      if (detailsMatch) {
        // Process reasoning content
        reasoning = detailsMatch.join("\n");

        // Remove <summary>...</summary>
        reasoning = reasoning.replace(/<summary>.*?<\/summary>/gs, "");

        // Remove <details> tags
        reasoning = reasoning.replace(/<details[^>]*>/g, "");
        reasoning = reasoning.replace(/<\/details>/g, "");

        // Handle line prefix "> " (using multiline flag)
        reasoning = reasoning.replace(/^> /gm, "");

        reasoning = reasoning.trim();

        // Extract final content (everything outside <details> tags)
        finalContent = content.replace(/<details[^>]*>.*?<\/details>/gs, "");
      } else if (content.includes("</details>")) {
        // Handle partial edit_content (starts mid-tag)
        // Split by </details> to separate reasoning from content
        const parts = content.split("</details>");

        reasoning = parts[0];
        finalContent = parts.slice(1).join("</details>");

        // Remove <summary>...</summary>
        reasoning = reasoning.replace(/<summary>.*?<\/summary>/gs, "");

        // Remove any partial opening tags at the start (e.g., 'true" duration="5"...)
        reasoning = reasoning.replace(/^[^>]*>/, "");

        // Handle line prefix "> "
        reasoning = reasoning.replace(/^> /gm, "");

        reasoning = reasoning.trim();

        logger.debug(
          "Separate mode - extracted reasoning length: %d, content length: %d",
          reasoning.length,
          finalContent.length,
        );
        logger.debug("Separate mode - content preview: %s", finalContent.substring(0, 50));
      } else {
        // No details tags, treat all as final content
        finalContent = content;
      }
    }

    return { reasoning, content: finalContent };
  }

  // For "strip", "thinking", and "think" modes, process as string
  let result = content;

  // Handle <think>...</think> format first (for test compatibility)
  if (content.includes("</think>")) {
    // Match <think>...</think> blocks
    const thinkBlocks = content.match(/<thinking[\s\S]*?<\/thinking>|<think[\s\S]*?<\/think>|<\/thinking>/gs);

    if (thinkBlocks) {
      switch (mode) {
        case "thinking":
          result = result.replace(/<think[^>]*>/g, "<thinking>").replace(/<\/think>/g, "</thinking>");
          break;
        case "think":
          result = result.replace(/<thinking[^>]*>/g, "<think>").replace(/<\/thinking>/g, "</think>");
          break;
        case "strip":
          result = result.replace(/<thinking[^>]*>.*?<\/thinking>/gs, "").replace(/<think[^>]*>.*?<\/think>/gs, "");
          break;
      }
    }
  }

  // Handle complete <details> tags
  if (content.match(/<details[^>]*>.*?<\/details>/gs)) {
    switch (mode) {
      case "thinking":
        // Convert <details> to <thinking>, preserve content structure
        result = result.replace(/<details[^>]*>/g, "<thinking>");
        result = result.replace(/<\/details>/g, "</thinking>");
        break;
      case "think":
        // Convert <details> to <think>, preserve content structure
        result = result.replace(/<details[^>]*>/g, "<think>");
        result = result.replace(/<\/details>/g, "</think>");
        break;
      case "strip":
        // Remove <details> tags but keep content
        result = result.replace(/<details[^>]*>/g, "");
        result = result.replace(/<\/details>/g, "");
        break;
    }
  } else if (content.includes("</details>")) {
    // Handle partial edit_content
    const parts = content.split("</details>");
    let thinkingPart = parts[0];
    const contentPart = parts.slice(1).join("</details>");

    // Remove partial opening tag
    thinkingPart = thinkingPart.replace(/^[^>]*>/, "");

    switch (mode) {
      case "thinking":
        result = "<thinking>" + thinkingPart + "</thinking>" + contentPart;
        break;
      case "think":
        result = "<think>" + thinkingPart + "</think>" + contentPart;
        break;
      case "strip":
        result = thinkingPart + contentPart;
        break;
    }
  }

  // Remove <summary>...</summary> tags
  result = result.replace(/<summary>.*?<\/summary>/gs, "");

  // Clean up other custom tags
  result = result.replace(/<Full>/g, "");
  result = result.replace(/<\/Full>/g, "");

  // Handle line prefix "> " (using multiline flag for proper matching)
  result = result.replace(/^> /gm, "");

  // Clean up extra whitespace but preserve paragraph structure
  result = result.replace(/\n\s*\n\s*\n/g, "\n\n"); // Multiple newlines to double newlines

  return result;
}

// Collect full response for non-streaming mode
export async function collectFullResponse(
  body: ReadableStream<Uint8Array>,
  thinkTagsMode: "strip" | "thinking" | "think" | "raw" | "separate" = THINK_TAGS_MODE as
    | "strip"
    | "thinking"
    | "think"
    | "raw"
    | "separate",
): Promise<{ content: string; reasoning_content?: string; usage: Usage | null }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullContent = "";
  let fullReasoning = "";
  let accumulatedThinking = "";
  let finalUsage: Usage | null = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const dataStr = line.substring(6);
          if (dataStr === "") continue;

          try {
            const upstreamData = JSON.parse(dataStr) as UpstreamData;

            // Capture usage information if present
            if (upstreamData.data.usage) {
              finalUsage = upstreamData.data.usage;
              logger.debug(
                "Captured usage data in non-streaming: prompt=%d, completion=%d, total=%d",
                finalUsage.prompt_tokens,
                finalUsage.completion_tokens,
                finalUsage.total_tokens,
              );
            }

            // Handle edit_content (complete thinking block)
            if (upstreamData.data.edit_content) {
              logger.debug("Received edit_content in non-streaming, length: %d", upstreamData.data.edit_content.length);

              if (thinkTagsMode === "separate") {
                // For separate mode, extract reasoning and content separately
                if (!fullReasoning) {
                  const transformed = transformThinking(upstreamData.data.edit_content, thinkTagsMode);
                  if (typeof transformed === "object") {
                    fullReasoning = transformed.reasoning;
                    logger.debug("Extracted reasoning from edit_content, length: %d", fullReasoning.length);

                    // Also add the content part from edit_content to fullContent
                    if (transformed.content && transformed.content.trim() !== "") {
                      fullContent += transformed.content || "";
                      logger.debug(
                        "Added content part from edit_content, length: %d",
                        (transformed.content || "").length,
                      );
                    }
                  }
                }
              } else {
                // For other modes, process the thinking content and add to fullContent
                const transformed = transformThinking(upstreamData.data.edit_content, thinkTagsMode);
                const processedContent = typeof transformed === "string" ? transformed : transformed.content;

                if (processedContent && processedContent.trim() !== "") {
                  fullContent += processedContent || "";
                  logger.debug(
                    "Added processed edit_content to fullContent, length: %d",
                    (processedContent || "").length,
                  );
                }
              }
            }

            if (upstreamData.data.delta_content && upstreamData.data.delta_content !== "") {
              const rawContent = upstreamData.data.delta_content || "";
              const isThinking = upstreamData.data.phase === "thinking";

              if (thinkTagsMode === "separate") {
                if (isThinking) {
                  accumulatedThinking += rawContent;
                } else {
                  fullContent += rawContent;
                }
              } else {
                // For non-separate modes, only process non-thinking content
                // Thinking content is handled by edit_content
                if (!isThinking) {
                  fullContent += rawContent;
                }
              }
            }

            if (upstreamData.data.done || upstreamData.data.phase === "done") {
              logger.debug("Detected completion signal, stopping collection");

              // Process accumulated thinking if in separate mode (only if not already set from edit_content)
              if (thinkTagsMode === "separate" && accumulatedThinking && !fullReasoning) {
                const transformed = transformThinking(accumulatedThinking, thinkTagsMode);
                if (typeof transformed === "object") {
                  fullReasoning = transformed.reasoning;
                  logger.debug("Set fullReasoning from accumulated thinking, length: %d", fullReasoning.length);
                }
              }

              logger.debug(
                "collectFullResponse early return - content length: %d, reasoning length: %d",
                fullContent.length,
                fullReasoning ? fullReasoning.length : 0,
              );

              return {
                content: fullContent,
                reasoning_content: fullReasoning || undefined,
                usage: finalUsage,
              };
            }
          } catch (_error) {
            // ignore parse errors
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  // Process accumulated thinking if in separate mode
  if (thinkTagsMode === "separate" && accumulatedThinking) {
    const transformed = transformThinking(accumulatedThinking, thinkTagsMode);
    if (typeof transformed === "object") {
      fullReasoning = transformed.reasoning;
    }
  }

  logger.debug(
    "collectFullResponse returning - content length: %d, reasoning length: %d",
    fullContent.length,
    fullReasoning ? fullReasoning.length : 0,
  );

  return {
    content: fullContent,
    reasoning_content: fullReasoning || undefined,
    usage: finalUsage,
  };
}
