/**
 * Anthropic API implementation for ZtoApi-Deno
 * Complete rewrite for stability and proper format compliance
 *
 * @author ZtoApi Team
 * @version 2.0.0
 * @since 2024
 */

import type { Message, OpenAIRequest, OpenAIResponse, ToolCall } from "../types/definitions.ts";
import { mapModelId, SUPPORTED_MODELS } from "../config/models.ts";

// Temporary simple tokenizer to avoid import issues
function simpleTokenize(text: string): number {
  // Rough approximation: 1 token per 4 characters
  return Math.ceil(text.length / 4);
}

/**
 * Anthropic API interfaces
 */
interface AnthropicTextContent {
  type: "text";
  text: string;
}

interface AnthropicImageContent {
  type: "image";
  source: {
    type: "base64";
    media_type: string;
    data: string;
  };
}

interface AnthropicToolUseContent {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface AnthropicToolResultContent {
  type: "tool_result";
  tool_use_id: string;
  content?: string | AnthropicTextContent[];
  is_error?: boolean;
}

type AnthropicContent =
  | AnthropicTextContent
  | AnthropicImageContent
  | AnthropicToolUseContent
  | AnthropicToolResultContent;

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicContent[];
}

interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface AnthropicToolChoice {
  type: "auto" | "any" | "tool";
  name?: string;
}

interface AnthropicMessagesRequest {
  model: string;
  max_tokens?: number;
  messages: AnthropicMessage[];
  system?: string | Array<{ type: "text"; text: string }>;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stream?: boolean;
  stop_sequences?: string[];
  tools?: AnthropicTool[];
  tool_choice?: AnthropicToolChoice;
}

interface AnthropicUsage {
  input_tokens: number;
  output_tokens: number;
}

interface AnthropicMessagesResponse {
  id: string;
  type: "message";
  role: "assistant";
  model: string;
  content: AnthropicContent[];
  stop_reason: "end_turn" | "max_tokens" | "stop_sequence" | "tool_use" | null;
  stop_sequence: string | null;
  usage: AnthropicUsage;
}

interface AnthropicStreamEvent {
  type:
    | "message_start"
    | "content_block_start"
    | "content_block_delta"
    | "content_block_stop"
    | "message_delta"
    | "message_stop"
    | "error";
  message?: Partial<AnthropicMessagesResponse>;
  content_block?: AnthropicContent;
  delta?: {
    type: "text_delta" | "input_json_delta";
    text?: string;
    partial_json?: string;
    stop_reason?: "end_turn" | "max_tokens" | "stop_sequence" | "tool_use" | null;
    stop_sequence?: string | null;
  };
  index?: number;
  usage?: { output_tokens: number };
}

interface AnthropicTokenCountRequest {
  model: string;
  system?: string | Array<{ type: "text"; text: string }>;
  messages: AnthropicMessage[];
}

interface AnthropicTokenCountResponse {
  input_tokens: number;
}

interface AnthropicModel {
  id: string;
  object: "model";
  created: number;
  type: string;
}

interface AnthropicError {
  type: "error";
  error: {
    type:
      | "invalid_request_error"
      | "authentication_error"
      | "permission_error"
      | "rate_limit_error"
      | "api_error"
      | "overloaded_error"
      | "timeout_error"
      | "billing_error"
      | "not_found_error";
    message: string;
  };
}

/**
 * Convert Anthropic request to OpenAI-compatible format
 */
function convertAnthropicToOpenAI(request: AnthropicMessagesRequest): OpenAIRequest {
  const messages: Message[] = [];

  // Add system message if present
  if (request.system) {
    let systemContent = "";
    if (typeof request.system === "string") {
      systemContent = request.system;
    } else if (Array.isArray(request.system)) {
      systemContent = request.system
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n");
    }

    if (systemContent.trim()) {
      messages.push({
        role: "system",
        content: systemContent,
      });
    }
  }

  // Convert Anthropic messages to OpenAI format
  for (const message of request.messages) {
    const openaiMessage: Message = {
      role: message.role,
      content: "",
    };

    if (typeof message.content === "string") {
      openaiMessage.content = message.content;
    } else if (Array.isArray(message.content)) {
      const contentParts: Array<{
        type: string;
        text?: string;
        image_url?: { url: string };
      }> = [];
      const toolCalls: ToolCall[] = [];

      for (const part of message.content) {
        switch (part.type) {
          case "text":
            contentParts.push({
              type: "text",
              text: part.text,
            });
            break;

          case "image": {
            const source = part.source;
            if (source.type === "base64") {
              contentParts.push({
                type: "image_url",
                image_url: {
                  url: `data:${source.media_type};base64,${source.data}`,
                },
              });
            }
            break;
          }

          case "tool_use":
            toolCalls.push({
              id: part.id,
              type: "function",
              function: {
                name: part.name,
                arguments: JSON.stringify(part.input),
              },
            });
            break;

          case "tool_result": {
            let toolContent = "";
            if (typeof part.content === "string") {
              toolContent = part.content;
            } else if (Array.isArray(part.content)) {
              toolContent = part.content
                .filter((item) => item.type === "text")
                .map((item) => item.text)
                .join("\n");
            }

            messages.push({
              role: "tool",
              content: toolContent,
              tool_call_id: part.tool_use_id,
            });
            continue;
          }
        }
      }

      if (toolCalls.length > 0) {
        openaiMessage.tool_calls = toolCalls;
        const textContent = contentParts
          .filter((part) => part.type === "text")
          .map((part) => part.text)
          .join("\n");
        openaiMessage.content = textContent || "";
      } else if (contentParts.length > 0) {
        openaiMessage.content = contentParts;
      } else {
        openaiMessage.content = "";
      }
    }

    messages.push(openaiMessage);
  }

  // Build the OpenAI request
  const openaiRequest: OpenAIRequest = {
    model: mapModelId(request.model),
    messages,
    stream: request.stream || false,
  };

  // Add max_tokens if specified
  if (request.max_tokens !== undefined) {
    openaiRequest.max_tokens = request.max_tokens;
  }

  // Add optional parameters
  if (request.temperature !== undefined) {
    openaiRequest.temperature = request.temperature;
  }
  if (request.top_p !== undefined) {
    openaiRequest.top_p = request.top_p;
  }
  if (request.stop_sequences && request.stop_sequences.length > 0) {
    openaiRequest.stop = request.stop_sequences;
  }

  // Convert tools if present
  if (request.tools && request.tools.length > 0) {
    openaiRequest.tools = request.tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
      },
    }));

    if (request.tool_choice) {
      switch (request.tool_choice.type) {
        case "auto":
          openaiRequest.tool_choice = "auto";
          break;
        case "any":
          openaiRequest.tool_choice = "required";
          break;
        case "tool":
          if (request.tool_choice.name) {
            openaiRequest.tool_choice = {
              type: "function",
              function: { name: request.tool_choice.name },
            };
          }
          break;
      }
    }
  }

  return openaiRequest;
}

/**
 * Convert OpenAI response to Anthropic format
 */
function convertOpenAIToAnthropic(
  response: OpenAIResponse,
  originalModel: string,
  requestId: string,
): AnthropicMessagesResponse {
  const choice = response.choices?.[0];
  if (!choice || !choice.message) {
    throw new Error("Invalid OpenAI response: no choices found");
  }

  const message = choice.message;
  const content: AnthropicContent[] = [];

  // Add text content if present
  if (message.content && typeof message.content === "string" && message.content.trim()) {
    content.push({
      type: "text",
      text: message.content,
    });
  }

  // Add tool calls if present
  if (message.tool_calls && Array.isArray(message.tool_calls)) {
    for (const toolCall of message.tool_calls) {
      let input: Record<string, unknown> = {};
      try {
        input = JSON.parse(toolCall.function.arguments);
      } catch {
        // If parsing fails, use empty object
      }

      content.push({
        type: "tool_use",
        id: toolCall.id,
        name: toolCall.function.name,
        input,
      });
    }
  }

  // Convert finish reason
  let stopReason: AnthropicMessagesResponse["stop_reason"] = "end_turn";
  switch (choice.finish_reason) {
    case "length":
      stopReason = "max_tokens";
      break;
    case "function_call":
    case "tool_calls":
      stopReason = "tool_use";
      break;
    case "content_filter":
      stopReason = "stop_sequence";
      break;
    default:
      stopReason = "end_turn";
  }

  return {
    id: `msg_${requestId}`,
    type: "message",
    role: "assistant",
    model: originalModel,
    content,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: {
      input_tokens: response.usage?.prompt_tokens || 0,
      output_tokens: response.usage?.completion_tokens || 0,
    },
  };
}

/**
 * Count tokens using gpt-tokenizer
 */
function countTokens(request: AnthropicTokenCountRequest): number {
  let text = "";

  // Add system text
  if (request.system) {
    if (typeof request.system === "string") {
      text += request.system + "\n";
    } else if (Array.isArray(request.system)) {
      text += request.system
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n") + "\n";
    }
  }

  // Add message text
  for (const message of request.messages) {
    text += `${message.role}: `;

    if (typeof message.content === "string") {
      text += message.content;
    } else if (Array.isArray(message.content)) {
      text += message.content
        .filter((part) => part.type === "text")
        .map((part) => (part as AnthropicTextContent).text)
        .join("\n");
    }

    text += "\n";
  }

  try {
    return simpleTokenize(text);
  } catch (error) {
    console.warn("Token counting failed, using character-based estimation:", error);
    return Math.ceil(text.length / 4);
  }
}

/**
 * Process streaming response and convert to Anthropic format
 */
async function* processAnthropicStream(
  body: ReadableStream<Uint8Array>,
  originalModel: string,
  requestId: string,
): AsyncGenerator<string, void, unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let messageStarted = false;
  let contentBlockStarted = false;
  let textBlockIndex = 0;
  let nextBlockIndex = 0;
  let _inputTokens = 0;
  let outputTokens = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const dataStr = line.substring(6).trim();
          if (dataStr === "[DONE]") {
            // Send message_stop event
            yield `event: message_stop\ndata: {"type":"message_stop"}\n\n`;
            return;
          }

          try {
            const chunk = JSON.parse(dataStr);
            const choice = chunk.choices?.[0];

            if (!choice) continue;

            // Send message_start if this is the first chunk
            if (!messageStarted) {
              messageStarted = true;

              const startEvent: AnthropicStreamEvent = {
                type: "message_start",
                message: {
                  id: `msg_${requestId}`,
                  type: "message",
                  role: "assistant",
                  model: originalModel,
                  content: [],
                  stop_reason: null,
                  usage: { input_tokens: 0, output_tokens: 0 },
                },
              };

              yield `event: message_start\ndata: ${JSON.stringify(startEvent)}\n\n`;
            }

            const delta = choice.delta || {};

            // Handle text content
            if (delta.content && typeof delta.content === "string") {
              // Send content_block_start if this is the first content
              if (!contentBlockStarted) {
                contentBlockStarted = true;
                textBlockIndex = nextBlockIndex++;
                const blockStartEvent: AnthropicStreamEvent = {
                  type: "content_block_start",
                  index: textBlockIndex,
                  content_block: {
                    type: "text",
                    text: "",
                  },
                };
                yield `event: content_block_start\ndata: ${JSON.stringify(blockStartEvent)}\n\n`;
              }

              // Send content delta
              const deltaEvent: AnthropicStreamEvent = {
                type: "content_block_delta",
                index: textBlockIndex,
                delta: {
                  type: "text_delta",
                  text: delta.content,
                },
              };
              yield `event: content_block_delta\ndata: ${JSON.stringify(deltaEvent)}\n\n`;
            }

            // Handle tool calls streaming
            if (delta.tool_calls && Array.isArray(delta.tool_calls)) {
              if (contentBlockStarted) {
                const blockStopEvent: AnthropicStreamEvent = {
                  type: "content_block_stop",
                  index: textBlockIndex,
                };
                yield `event: content_block_stop\ndata: ${JSON.stringify(blockStopEvent)}\n\n`;
                contentBlockStarted = false;
              }

              for (const tc of delta.tool_calls) {
                const toolBlockIndex = nextBlockIndex++;
                const toolStartEvent: AnthropicStreamEvent = {
                  type: "content_block_start",
                  index: toolBlockIndex,
                  content_block: {
                    type: "tool_use",
                    id: tc.id || `call_${Date.now()}`,
                    name: tc.function?.name || "",
                    input: {},
                  },
                };
                yield `event: content_block_start\ndata: ${JSON.stringify(toolStartEvent)}\n\n`;

                const argStr = tc.function?.arguments || "";
                if (argStr) {
                  const toolDeltaEvent: AnthropicStreamEvent = {
                    type: "content_block_delta",
                    index: toolBlockIndex,
                    delta: {
                      type: "input_json_delta",
                      partial_json: argStr,
                    },
                  };
                  yield `event: content_block_delta\ndata: ${JSON.stringify(toolDeltaEvent)}\n\n`;
                }

                const toolStopEvent: AnthropicStreamEvent = {
                  type: "content_block_stop",
                  index: toolBlockIndex,
                };
                yield `event: content_block_stop\ndata: ${JSON.stringify(toolStopEvent)}\n\n`;
              }
            }

            // Handle completion
            if (choice.finish_reason) {
              // Send content_block_stop if we had content
              if (contentBlockStarted) {
                const blockStopEvent: AnthropicStreamEvent = {
                  type: "content_block_stop",
                  index: textBlockIndex,
                };
                yield `event: content_block_stop\ndata: ${JSON.stringify(blockStopEvent)}\n\n`;
                contentBlockStarted = false;
              }

              // Map finish reason
              let stopReason: AnthropicMessagesResponse["stop_reason"] = "end_turn";
              switch (choice.finish_reason) {
                case "length":
                  stopReason = "max_tokens";
                  break;
                case "function_call":
                case "tool_calls":
                  stopReason = "tool_use";
                  break;
                case "content_filter":
                  stopReason = "stop_sequence";
                  break;
                default:
                  stopReason = "end_turn";
              }

              // Get usage info
              if (chunk.usage) {
                outputTokens = chunk.usage.completion_tokens || 0;
                _inputTokens = chunk.usage.prompt_tokens || 0;
              }

              // Send message_delta
              const messageDeltaEvent: AnthropicStreamEvent = {
                type: "message_delta",
                delta: {
                  stop_reason: stopReason,
                  stop_sequence: null,
                } as unknown as AnthropicStreamEvent["delta"],
                usage: { output_tokens: outputTokens },
              };
              yield `event: message_delta\ndata: ${JSON.stringify(messageDeltaEvent)}\n\n`;

              // Send message_stop
              yield `event: message_stop\ndata: {"type":"message_stop"}\n\n`;
              return;
            }
          } catch (error) {
            console.warn("Failed to parse streaming chunk:", error);
            continue;
          }
        }
      }
    }
  } catch (error) {
    console.error("Error in Anthropic stream processing:", error);
    // Send error event
    const errorEvent = {
      type: "error",
      error: {
        type: "api_error",
        message: "Stream processing error",
      },
    };
    yield `event: error\ndata: ${JSON.stringify(errorEvent)}\n\n`;
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Ignore lock release errors
    }
  }
}

/**
 * Get list of available models for Anthropic endpoint
 */
function getClaudeModels(): AnthropicModel[] {
  return SUPPORTED_MODELS.map((model) => ({
    id: model.id,
    object: "model",
    created: Math.floor(Date.now() / 1000),
    type: "model",
  }));
}

/**
 * Create error response
 */
function createErrorResponse(
  type: AnthropicError["error"]["type"],
  message: string,
): AnthropicError {
  return {
    type: "error",
    error: {
      type,
      message,
    },
  };
}

export {
  type AnthropicError,
  type AnthropicMessagesRequest,
  type AnthropicMessagesResponse,
  type AnthropicModel,
  type AnthropicStreamEvent,
  type AnthropicTokenCountRequest,
  type AnthropicTokenCountResponse,
  convertAnthropicToOpenAI,
  convertOpenAIToAnthropic,
  countTokens,
  createErrorResponse,
  getClaudeModels,
  processAnthropicStream,
};
