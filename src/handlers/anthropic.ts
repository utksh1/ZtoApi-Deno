/**
 * Anthropic API handlers
 * Handles Anthropic-compatible API requests (/v1/messages, /v1/models, etc.)
 */

import {
  type AnthropicMessagesRequest,
  type AnthropicTokenCountRequest,
  convertAnthropicToOpenAI,
  convertOpenAIToAnthropic,
  countTokens,
  getClaudeModels,
  processAnthropicStream,
} from "../anthropic/core.ts";
import type { Message, ToolCall, UpstreamRequest } from "../types/definitions.ts";
import { getModelConfig } from "../config/models.ts";
import { addLiveRequest, recordRequestStats } from "../utils/stats.ts";
import { setCORSHeaders, validateApiKey } from "../utils/helpers.ts";
import { processMessages } from "../utils/validation.ts";
import { getUpstreamClient } from "../services/upstream-client.ts";
import { collectFullResponse } from "../utils/stream.ts";
import { debugLog } from "../utils/logger.ts";

/**
 * Handle Anthropic models endpoint
 */
export function handleAnthropicModels(request: Request): Response {
  const headers = new Headers();
  setCORSHeaders(headers);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers });
  }

  const models = getClaudeModels();

  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify({ data: models }), {
    status: 200,
    headers,
  });
}

/**
 * Handle Anthropic messages endpoint
 */
export async function handleAnthropicMessages(request: Request): Promise<Response> {
  const startTime = Date.now();
  const url = new URL(request.url);
  const path = url.pathname;
  const userAgent = request.headers.get("User-Agent") || "";

  debugLog("Received Anthropic messages request");
  debugLog("🌐 User-Agent: %s", userAgent);

  const headers = new Headers();
  setCORSHeaders(headers);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers });
  }

  // API key validation
  const authHeader = request.headers.get("Authorization") || request.headers.get("x-api-key");
  if (!authHeader || (!authHeader.startsWith("Bearer ") && !authHeader.startsWith("sk-"))) {
    debugLog("Missing or invalid Authorization header for Anthropic API");
    const duration = Date.now() - startTime;
    recordRequestStats(startTime, path, 401);
    addLiveRequest(request.method, path, 401, duration, userAgent, undefined, undefined, "Missing or invalid API key");
    return new Response(
      JSON.stringify({
        type: "error",
        error: {
          type: "authentication_error",
          message: "Missing or invalid API key",
        },
      }),
      {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      },
    );
  }

  const apiKey = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;
  if (!validateApiKey(`Bearer ${apiKey}`)) {
    debugLog("Invalid API key for Anthropic request");
    const duration = Date.now() - startTime;
    recordRequestStats(startTime, path, 401);
    addLiveRequest(request.method, path, 401, duration, userAgent, undefined, undefined, "Invalid API key");
    return new Response(
      JSON.stringify({
        type: "error",
        error: {
          type: "authentication_error",
          message: "Invalid API key",
        },
      }),
      {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      },
    );
  }

  debugLog("Anthropic API key validated");

  // Read request body
  let body: string;
  try {
    body = await request.text();
    debugLog("📥 Received Anthropic body length: %d chars", body.length);
  } catch (error) {
    debugLog("Failed to read Anthropic request body: %v", error);
    const duration = Date.now() - startTime;
    recordRequestStats(startTime, path, 400);
    addLiveRequest(request.method, path, 400, duration, userAgent, undefined, undefined, "Failed to read request body");
    return new Response(
      JSON.stringify({
        type: "error",
        error: {
          type: "invalid_request_error",
          message: "Failed to read request body",
        },
      }),
      {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      },
    );
  }

  // Parse JSON
  let anthropicReq: AnthropicMessagesRequest;
  try {
    anthropicReq = JSON.parse(body) as AnthropicMessagesRequest;
    debugLog("✅ Anthropic JSON parsed successfully");
  } catch (error) {
    debugLog("Anthropic JSON parse failed: %v", error);
    const duration = Date.now() - startTime;
    recordRequestStats(startTime, path, 400);
    addLiveRequest(request.method, path, 400, duration, userAgent, undefined, undefined, "Invalid JSON");
    return new Response(
      JSON.stringify({
        type: "error",
        error: {
          type: "invalid_request_error",
          message: "Invalid JSON",
        },
      }),
      {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      },
    );
  }

  // Convert to OpenAI format for processing
  const model = anthropicReq.model || "GLM-5.3-Flash";
  const modelConfig = getModelConfig(model);
  const openaiReq = convertAnthropicToOpenAI(anthropicReq);
  const promptTokens = Math.max(1, Math.ceil(JSON.stringify(anthropicReq.messages || "").length / 4));

  debugLog("Converted to OpenAI format, model: %s", openaiReq.model);

  // Check if streaming
  const isStreaming = openaiReq.stream || false;

  // Get token for upstream request if provided
  let clientToken: string | undefined = undefined;
  if (apiKey && (apiKey.startsWith("eyJ") || apiKey.length > 50)) {
    clientToken = apiKey;
  }

  // Process messages
  let processedMessages: Message[];
  try {
    processedMessages = processMessages(openaiReq.messages as Message[], modelConfig);
  } catch (error) {
    debugLog("Failed to process messages: %v", error);
    const duration = Date.now() - startTime;
    const msg = error instanceof Error ? error.message : "Failed to process messages";
    recordRequestStats(startTime, path, 400);
    addLiveRequest(
      request.method,
      path,
      400,
      duration,
      userAgent,
      model,
      { prompt: promptTokens, total: promptTokens },
      msg,
    );
    return new Response(
      JSON.stringify({
        type: "error",
        error: {
          type: "invalid_request_error",
          message: msg,
        },
      }),
      {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      },
    );
  }

  // Create upstream request
  const upstreamReq: UpstreamRequest = {
    stream: isStreaming,
    model: modelConfig.upstreamId,
    messages: processedMessages,
    params: {
      top_p: modelConfig.defaultParams.top_p,
      temperature: modelConfig.defaultParams.temperature,
      ...(modelConfig.defaultParams.max_tokens && { max_tokens: modelConfig.defaultParams.max_tokens }),
    },
    features: {
      thinking: modelConfig.capabilities.thinking,
      ...(modelConfig.capabilities.vision && { vision: true }),
    },
    tools: openaiReq.tools as unknown as UpstreamRequest["tools"],
    tool_choice:
      (typeof openaiReq.tool_choice === "string" ? openaiReq.tool_choice : undefined) as UpstreamRequest["tool_choice"],
    chat_id: `chat_${Date.now()}_${Math.random().toString(36).substring(7)}`,
  };

  debugLog("Created upstream request: %s", JSON.stringify(upstreamReq, null, 2));

  // Call upstream using upstream client (supports browser bridge, session pooling, etc.)
  let response: Response;
  try {
    const upstreamClient = await getUpstreamClient();
    response = await upstreamClient.chatCompletion(upstreamReq, modelConfig, clientToken);
  } catch (error) {
    debugLog("Upstream request failed: %v", error);
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : "Failed to connect to upstream service";
    recordRequestStats(startTime, path, 500);
    addLiveRequest(
      request.method,
      path,
      500,
      duration,
      userAgent,
      model,
      { prompt: promptTokens, total: promptTokens },
      errorMsg,
    );
    return new Response(
      JSON.stringify({
        type: "error",
        error: {
          type: "upstream_error",
          message: "Failed to connect to upstream service",
        },
      }),
      {
        status: 500,
        headers: { ...headers, "Content-Type": "application/json" },
      },
    );
  }

  // Record stats
  const duration = Date.now() - startTime;
  recordRequestStats(startTime, path, response.status);
  addLiveRequest(
    request.method,
    path,
    response.status,
    duration,
    userAgent,
    model,
    { prompt: promptTokens, total: promptTokens },
    !response.ok ? `HTTP ${response.status}` : undefined,
  );

  // Convert response back to Anthropic format
  if (isStreaming) {
    return handleAnthropicStreamResponse(response, headers, model, openaiReq, startTime);
  } else {
    return handleAnthropicNonStreamResponse(response, headers, model, openaiReq, startTime);
  }
}

/**
 * Handle streaming response for Anthropic
 */
export async function handleAnthropicStreamResponse(
  upstreamResponse: Response,
  headers: Headers,
  model: string,
  _openaiReq: unknown,
  _startTime: number,
): Promise<Response> {
  if (!upstreamResponse.body) {
    const response = new Response(
      JSON.stringify({
        type: "error",
        error: {
          type: "upstream_error",
          message: "No response body from upstream",
        },
      }),
      {
        status: 500,
        headers: { ...headers, "Content-Type": "application/json" },
      },
    );
    await Promise.resolve();
    return response;
  }

  const encoder = new TextEncoder();
  const requestId = `msg_${Date.now()}`;

  // Set up headers for streaming
  setCORSHeaders(headers);
  headers.set("Content-Type", "text/event-stream; charset=utf-8");
  headers.set("Cache-Control", "no-cache, no-transform");
  headers.set("Connection", "keep-alive");
  headers.set("X-Accel-Buffering", "no");

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of processAnthropicStream(upstreamResponse.body!, model, requestId)) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      } catch (error) {
        debugLog("Error processing stream: %v", error);
        controller.error(error);
      }
    },
  });

  const response = new Response(stream, {
    status: upstreamResponse.status,
    headers,
  });

  await Promise.resolve();
  return response;
}

/**
 * Handle non-streaming response for Anthropic
 */
export async function handleAnthropicNonStreamResponse(
  upstreamResponse: Response,
  headers: Headers,
  model: string,
  _openaiReq: unknown,
  _startTime: number,
): Promise<Response> {
  if (!upstreamResponse.ok) {
    const errorBody = await upstreamResponse.text();
    debugLog("Upstream error: %s", errorBody);
    return new Response(
      JSON.stringify({
        type: "error",
        error: {
          type: "upstream_error",
          message: errorBody || "Upstream service returned an error",
        },
      }),
      {
        status: upstreamResponse.status,
        headers: { ...headers, "Content-Type": "application/json" },
      },
    );
  }

  try {
    const contentType = upstreamResponse.headers.get("content-type") || "";
    let content = "";
    let reasoningContent: string | undefined;
    let usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;
    let toolCalls: ToolCall[] | undefined;
    let finishReason = "stop";

    if (contentType.includes("application/json")) {
      const json = await upstreamResponse.json() as {
        choices?: Array<{
          message?: {
            content?: string | null;
            reasoning_content?: string;
            tool_calls?: ToolCall[];
          };
          finish_reason?: string;
        }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      };
      const choice = json.choices?.[0];
      content = choice?.message?.content || "";
      reasoningContent = choice?.message?.reasoning_content;
      toolCalls = choice?.message?.tool_calls;
      finishReason = choice?.finish_reason || (toolCalls && toolCalls.length > 0 ? "tool_calls" : "stop");
      usage = json.usage;
    } else if (upstreamResponse.body) {
      const result = await collectFullResponse(upstreamResponse.body);
      content = result.content;
      reasoningContent = result.reasoning_content;
      usage = result.usage || undefined;
    } else {
      throw new Error("No response body from upstream");
    }

    const openaiResp = {
      id: `chatcmpl-${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: model,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: content,
            ...(reasoningContent ? { reasoning_content: reasoningContent } : {}),
            ...(toolCalls && toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
          },
          finish_reason: finishReason,
        },
      ],
      ...(usage && { usage }),
    };

    const requestId = `msg_${Date.now()}`;
    const anthropicResp = convertOpenAIToAnthropic(openaiResp, model, requestId);
    headers.set("Content-Type", "application/json");
    return new Response(JSON.stringify(anthropicResp), {
      status: 200,
      headers,
    });
  } catch (error) {
    debugLog("Failed to process response: %v", error);
    return new Response(
      JSON.stringify({
        type: "error",
        error: {
          type: "upstream_error",
          message: "Failed to process response",
        },
      }),
      {
        status: 500,
        headers: { ...headers, "Content-Type": "application/json" },
      },
    );
  }
}

/**
 * Handle token count endpoint
 */
export async function handleAnthropicTokenCount(request: Request): Promise<Response> {
  const startTime = Date.now();
  const url = new URL(request.url);
  const path = url.pathname;
  const userAgent = request.headers.get("User-Agent") || "";

  debugLog("Received Anthropic token count request");

  const headers = new Headers();
  setCORSHeaders(headers);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers });
  }

  // Read and parse request body
  let body: string;
  try {
    body = await request.text();
  } catch (error) {
    debugLog("Failed to read request body: %v", error);
    const duration = Date.now() - startTime;
    recordRequestStats(startTime, path, 400);
    addLiveRequest(request.method, path, 400, duration, userAgent);
    return new Response(
      JSON.stringify({
        type: "error",
        error: {
          type: "invalid_request_error",
          message: "Failed to read request body",
        },
      }),
      {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      },
    );
  }

  let countReq: AnthropicTokenCountRequest;
  try {
    countReq = JSON.parse(body);
  } catch (error) {
    debugLog("Invalid JSON: %v", error);
    const duration = Date.now() - startTime;
    recordRequestStats(startTime, path, 400);
    addLiveRequest(request.method, path, 400, duration, userAgent);
    return new Response(
      JSON.stringify({
        type: "error",
        error: {
          type: "invalid_request_error",
          message: "Invalid JSON",
        },
      }),
      {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      },
    );
  }

  try {
    const result = await countTokens(countReq);
    const duration = Date.now() - startTime;
    recordRequestStats(startTime, path, 200);
    addLiveRequest(request.method, path, 200, duration, userAgent);

    headers.set("Content-Type", "application/json");
    return new Response(JSON.stringify(result), {
      status: 200,
      headers,
    });
  } catch (error) {
    debugLog("Token counting failed: %v", error);
    const duration = Date.now() - startTime;
    recordRequestStats(startTime, path, 500);
    addLiveRequest(request.method, path, 500, duration, userAgent);
    return new Response(
      JSON.stringify({
        type: "error",
        error: {
          type: "internal_error",
          message: "Token counting failed",
        },
      }),
      {
        status: 500,
        headers: { ...headers, "Content-Type": "application/json" },
      },
    );
  }
}
