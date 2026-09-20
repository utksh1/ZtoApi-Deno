/**
 * Server and routing logic
 * Handles HTTP request routing and server startup
 */

import { SUPPORTED_MODELS } from "../config/models.ts";
import { CONFIG, UPSTREAM_URL } from "../config/constants.ts";
import { addLiveRequest, addWsClient, recordRequestStats } from "../utils/stats.ts";
import { handleAnthropicMessages, handleAnthropicModels, handleAnthropicTokenCount } from "../handlers/anthropic.ts";
import { handleChatCompletions } from "../handlers/openai.ts";
import {
  handleDashboard,
  handleDashboardRequests,
  handleDashboardStats,
  handleDocs,
  handleIndex,
  handleModels,
  handleOptions,
  handleStatic,
} from "../handlers/dashboard.ts";
import { createAnthropicErrorResponse, createOpenAIErrorResponse, setCORSHeaders } from "../utils/helpers.ts";
import { debugLog } from "../utils/logger.ts";
import { BrowserBridgeService } from "../services/browser-bridge.ts";

/**
 * Start the server
 */
export function main(): void {
  console.log(`OpenAI-compatible API server starting`);
  console.log(`Supported models: ${SUPPORTED_MODELS.map((m) => `${m.id} (${m.name})`).join(", ")}`);
  console.log(`Upstream: ${UPSTREAM_URL}`);
  console.log(`Debug mode: ${CONFIG.DEBUG_MODE ? "ENABLED (Verbose Logging)" : "DISABLED (Performance Mode)"}`);
  console.log(`Default streaming: ${CONFIG.DEFAULT_STREAM}`);
  console.log(`Dashboard enabled: ${CONFIG.DASHBOARD_ENABLED}`);

  const port = parseInt(Deno.env.get("PORT") || "9090");
  console.log(`Running on port: ${port}`);

  if (CONFIG.DASHBOARD_ENABLED) {
    console.log(`Dashboard enabled at: http://localhost:${port}/dashboard`);
  }

  // Pre-warm browser bridge in background if available
  BrowserBridgeService.getInstance().prewarm().catch(() => {});

  Deno.serve({ port, handler: handleRequest });
}

/**
 * Handle HTTP requests (main router)
 */
export async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const startTime = Date.now();
  const userAgent = request.headers.get("User-Agent") || "";

  try {
    let response: Response;

    // Routing
    if (url.pathname === "/") {
      response = await handleIndex(request);
    } else if (url.pathname === "/healthz" || url.pathname === "/health") {
      const headers = new Headers({ "Content-Type": "application/json" });
      setCORSHeaders(headers);
      response = new Response(
        JSON.stringify({
          status: "healthy",
          service: "zaiproxy",
          version: "2.0.0",
          models: SUPPORTED_MODELS.map((m) => m.id),
          timestamp: Date.now(),
        }),
        { status: 200, headers },
      );
    } else if (url.pathname.startsWith("/ui/")) {
      response = await handleStatic(request);
    } else if (url.pathname === "/v1/models" || url.pathname === "/models") {
      response = handleModels(request);
    } else if (
      url.pathname === "/v1/chat/completions" ||
      url.pathname === "/v1/chat/completion" ||
      url.pathname === "/chat/completions" ||
      url.pathname === "/chat/completion"
    ) {
      return await handleChatCompletions(request);
    } else if (url.pathname === "/anthropic/v1/models") {
      response = handleAnthropicModels(request);
    } else if (url.pathname === "/anthropic/v1/messages") {
      return await handleAnthropicMessages(request);
    } else if (url.pathname === "/anthropic/v1/messages/count_tokens") {
      response = await handleAnthropicTokenCount(request);
    } else if (url.pathname === "/docs") {
      response = await handleDocs(request);
    } else if (url.pathname === "/dashboard" && CONFIG.DASHBOARD_ENABLED) {
      response = await handleDashboard(request);
    } else if (url.pathname === "/dashboard/stats" && CONFIG.DASHBOARD_ENABLED) {
      response = handleDashboardStats(request);
    } else if (url.pathname === "/dashboard/requests" && CONFIG.DASHBOARD_ENABLED) {
      response = handleDashboardRequests(request);
    } else if (url.pathname === "/dashboard/ws" && CONFIG.DASHBOARD_ENABLED) {
      if (request.headers.get("upgrade")?.toLowerCase() === "websocket") {
        const { response: wsResponse, socket } = Deno.upgradeWebSocket(request);
        addWsClient(socket);
        return wsResponse;
      }
      return new Response("Expected WebSocket upgrade", { status: 400 });
    } else {
      response = handleOptions(request);
    }

    const isInternal = url.pathname.startsWith("/dashboard") ||
      url.pathname.startsWith("/ui/") ||
      url.pathname === "/favicon.ico" ||
      url.pathname === "/healthz" ||
      url.pathname === "/health" ||
      request.method === "OPTIONS";

    if (!isInternal) {
      recordRequestStats(startTime, url.pathname, response.status);
      addLiveRequest(request.method, url.pathname, response.status, Date.now() - startTime, userAgent);
    }
    return response;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Internal Server Error";
    debugLog("Error handling request: %v", error);
    if (!url.pathname.startsWith("/dashboard") && !url.pathname.startsWith("/ui/")) {
      recordRequestStats(startTime, url.pathname, 500);
      addLiveRequest(
        request.method,
        url.pathname,
        500,
        Date.now() - startTime,
        userAgent,
        undefined,
        undefined,
        errorMsg,
      );
    }
    if (url.pathname.startsWith("/anthropic")) {
      return createAnthropicErrorResponse(500, errorMsg, "api_error");
    }
    if (url.pathname.startsWith("/v1")) {
      return createOpenAIErrorResponse(500, errorMsg, "server_error", "internal_error");
    }
    return new Response(errorMsg, { status: 500 });
  }
}

// Load .env variables if present
try {
  const envContent = await Deno.readTextFile(".env");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!Deno.env.get(key)) {
        Deno.env.set(key, val);
      }
    }
  }
} catch {
  // .env file optional
}

// Start server when executed directly
if (import.meta.main) {
  main();
}
