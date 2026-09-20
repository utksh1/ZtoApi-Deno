/**
 * OpenAI API handlers
 * Handles OpenAI-compatible chat completions API (/v1/chat/completions)
 */

import type { Message, OpenAIRequest, UpstreamRequest } from "../types/definitions.ts";
import { getModelConfig } from "../config/models.ts";
import { addLiveRequest, recordRequestStats, updateLiveRequest } from "../utils/stats.ts";
import { createOpenAIErrorResponse, setCORSHeaders, validateApiKey } from "../utils/helpers.ts";
import { processMessages } from "../utils/validation.ts";
import { getUpstreamClient } from "../services/upstream-client.ts";
import { debugLog } from "../utils/logger.ts";

/**
 * Handle OpenAI-compatible chat completions
 */
export async function handleChatCompletions(request: Request): Promise<Response> {
  const startTime = Date.now();
  const url = new URL(request.url);
  const path = url.pathname;
  const userAgent = request.headers.get("User-Agent") || "";

  debugLog("Received chat completions request");
  debugLog("🌐 User-Agent: %s", userAgent);

  // Read feature control headers
  const _thinkingHeader = request.headers.get("X-Feature-Thinking") || request.headers.get("X-Thinking");
  const _thinkTagsModeHeader = request.headers.get("X-Think-Tags-Mode");

  const headers = new Headers();
  setCORSHeaders(headers);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers });
  }

  // API key validation
  const authHeader = request.headers.get("Authorization");
  if (authHeader && !validateApiKey(authHeader)) {
    debugLog("Invalid Authorization header");
    const duration = Date.now() - startTime;
    recordRequestStats(startTime, path, 401);
    addLiveRequest(
      request.method,
      path,
      401,
      duration,
      userAgent,
      undefined,
      undefined,
      "Invalid or missing Authorization header",
    );
    return createOpenAIErrorResponse(
      401,
      "Incorrect API key provided or invalid authorization header format.",
      "authentication_error",
      "invalid_api_key",
      headers,
    );
  }

  // Read request body
  let body: string;
  try {
    body = await request.text();
    debugLog("📥 Received body length: %d chars", body.length);
  } catch (error) {
    debugLog("Failed to read request body: %v", error);
    const duration = Date.now() - startTime;
    recordRequestStats(startTime, path, 400);
    addLiveRequest(request.method, path, 400, duration, userAgent, undefined, undefined, "Failed to read request body");
    return createOpenAIErrorResponse(
      400,
      "Failed to read request body",
      "invalid_request_error",
      "bad_request",
      headers,
    );
  }

  // Parse JSON
  let openaiReq: OpenAIRequest;
  try {
    openaiReq = JSON.parse(body);
  } catch (_error) {
    debugLog("JSON parse failed");
    const duration = Date.now() - startTime;
    recordRequestStats(startTime, path, 400);
    addLiveRequest(request.method, path, 400, duration, userAgent, undefined, undefined, "Invalid JSON body");
    return createOpenAIErrorResponse(
      400,
      "Invalid JSON payload in request body",
      "invalid_request_error",
      "invalid_json",
      headers,
    );
  }

  const model = openaiReq.model || "GLM-5.3-Flash";
  const modelConfig = getModelConfig(model);

  debugLog("Model: %s, Config: %s", model, modelConfig.id);

  // Check if streaming
  const isStreaming = openaiReq.stream !== false;

  // Process messages & estimate prompt tokens
  let processedMessages: Message[];
  let promptTokens = Math.max(1, Math.ceil(JSON.stringify(openaiReq.messages || "").length / 4));
  try {
    processedMessages = processMessages(openaiReq.messages, modelConfig);
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
    return createOpenAIErrorResponse(400, msg, "invalid_request_error", "invalid_request_body", headers);
  }

  // Map reasoning effort if provided
  const reasoningEffort = openaiReq.reasoning_effort;

  // Create upstream request
  const upstreamReq: UpstreamRequest = {
    stream: isStreaming,
    model: model,
    messages: processedMessages,
    params: {
      top_p: modelConfig.defaultParams.top_p,
      temperature: openaiReq.temperature ?? modelConfig.defaultParams.temperature,
      ...((openaiReq.max_tokens ?? modelConfig.defaultParams.max_tokens) && {
        max_tokens: openaiReq.max_tokens ?? modelConfig.defaultParams.max_tokens,
      }),
    },
    features: {
      thinking: modelConfig.capabilities.thinking,
      ...(modelConfig.capabilities.vision && { vision: true }),
      ...(reasoningEffort && { reasoning_effort: reasoningEffort }),
    },
    enable_thinking: modelConfig.capabilities.thinking,
    reasoning_effort: reasoningEffort,
    tools: openaiReq.tools,
    tool_choice: openaiReq.tool_choice,
  };

  debugLog("Created upstream request");

  // Call upstream using new upstream client
  let response: Response;
  try {
    const authHeader = request.headers.get("Authorization");
    let clientToken: string | undefined = undefined;
    if (authHeader?.startsWith("Bearer ")) {
      const raw = authHeader.substring(7).trim();
      if (raw.startsWith("eyJ") || raw.length > 50) {
        clientToken = raw;
      }
    }

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
    return createOpenAIErrorResponse(500, errorMsg, "upstream_error", "upstream_service_error", headers);
  }

  // Parse error or tokens
  let errorMsg: string | undefined;
  let completionTokens = 0;

  if (!response.ok) {
    try {
      const errData = await response.clone().json();
      errorMsg = errData?.error?.message || errData?.message || `HTTP ${response.status}`;
    } catch {
      errorMsg = `HTTP ${response.status} from upstream`;
    }
  } else if (!isStreaming) {
    try {
      const respJson = await response.clone().json();
      if (respJson?.usage?.completion_tokens) {
        completionTokens = respJson.usage.completion_tokens;
        if (respJson.usage.prompt_tokens) promptTokens = respJson.usage.prompt_tokens;
      }
    } catch {
      // ignore
    }
  }

  // Record stats
  const duration = Date.now() - startTime;
  recordRequestStats(startTime, path, response.status);
  const liveReq = addLiveRequest(
    request.method,
    path,
    response.status,
    duration,
    userAgent,
    model,
    {
      prompt: promptTokens,
      completion: completionTokens,
      total: promptTokens + completionTokens,
    },
    errorMsg,
  );

  // For streaming responses, track completion tokens as chunks stream
  if (response.ok && isStreaming && response.body) {
    let completionChars = 0;
    const stream = response.body.pipeThrough(
      new TransformStream({
        transform(chunk, controller) {
          completionChars += chunk.length;
          controller.enqueue(chunk);
        },
        flush() {
          const compTokens = Math.max(1, Math.ceil(completionChars / 12));
          updateLiveRequest(liveReq.id, {
            tokens: {
              prompt: promptTokens,
              completion: compTokens,
              total: promptTokens + compTokens,
            },
          });
        },
      }),
    );
    const respHeaders = new Headers(response.headers);
    respHeaders.set("Content-Type", "text/event-stream; charset=utf-8");
    respHeaders.set("Cache-Control", "no-cache, no-transform");
    respHeaders.set("Connection", "keep-alive");
    respHeaders.set("X-Accel-Buffering", "no");
    setCORSHeaders(respHeaders);
    return new Response(stream, { status: response.status, headers: respHeaders });
  }

  // Upstream client already returns properly formatted response, just add CORS headers
  setCORSHeaders(headers);
  return response;
}
