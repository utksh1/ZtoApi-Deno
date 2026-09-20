/**
 * Dashboard and Docs handlers
 * Handles index, dashboard, docs, and static asset requests
 */

import { SUPPORTED_MODELS } from "../config/models.ts";
import type { ModelsResponse } from "../types/definitions.ts";
import { setCORSHeaders } from "../utils/helpers.ts";
import { getLiveRequestsData, getStatsData } from "../utils/stats.ts";

/**
 * Read index.html file
 */
export async function getIndexHTML(): Promise<string> {
  return await Deno.readTextFile(`${Deno.cwd()}/ui/index.html`);
}

/**
 * Handle index request
 */
export async function handleIndex(_request: Request): Promise<Response> {
  try {
    const html = await getIndexHTML();
    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch {
    return new Response("UI not found", { status: 404 });
  }
}

/**
 * Handle OPTIONS preflight requests
 */
export function handleOptions(request: Request): Response {
  const headers = new Headers();
  setCORSHeaders(headers);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers });
  }

  return new Response("Not Found", { status: 404, headers });
}

/**
 * Handle models list request
 */
export function handleModels(request: Request): Response {
  const headers = new Headers();
  setCORSHeaders(headers);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers });
  }

  const models = SUPPORTED_MODELS.map((model) => ({
    id: model.name,
    object: "model",
    created: Math.floor(Date.now() / 1000),
    owned_by: "z.ai",
    context_window: model.contextWindow || 128000,
    max_output_tokens: model.defaultParams.max_tokens || 128000,
  }));

  const response: ModelsResponse = {
    object: "list",
    data: models,
  };

  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(response), {
    status: 200,
    headers,
  });
}

/**
 * Read dashboard HTML
 */
export async function getDashboardHTML(): Promise<string> {
  return await Deno.readTextFile(`${Deno.cwd()}/ui/dashboard/dashboard.html`);
}

/**
 * Handle dashboard request
 */
export async function handleDashboard(_request: Request): Promise<Response> {
  try {
    const html = await getDashboardHTML();
    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch {
    return new Response("Dashboard UI not found", { status: 404 });
  }
}

/**
 * Handle dashboard stats
 */
export function handleDashboardStats(_request: Request): Response {
  const headers = new Headers();
  setCORSHeaders(headers);

  const stats = getStatsData();

  headers.set("Content-Type", "application/json");
  return new Response(stats, {
    status: 200,
    headers,
  });
}

/**
 * Handle dashboard live requests
 */
export function handleDashboardRequests(_request: Request): Response {
  const headers = new Headers();
  setCORSHeaders(headers);

  const requests = getLiveRequestsData();

  headers.set("Content-Type", "application/json");
  return new Response(requests, {
    status: 200,
    headers,
  });
}

/**
 * Read docs HTML
 */
export async function getDocsHTML(): Promise<string> {
  return await Deno.readTextFile(`${Deno.cwd()}/ui/docs/docs.html`);
}

/**
 * Handle docs request
 */
export async function handleDocs(_request: Request): Promise<Response> {
  try {
    const html = await getDocsHTML();
    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch {
    return new Response("Documentation not found", { status: 404 });
  }
}

/**
 * Handle static files
 */
export async function handleStatic(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // Simple static file handler for UI assets
  // path is like "/ui/index.css", we need to convert to filesystem path
  const filePath = `${Deno.cwd()}${path}`;

  try {
    const content = await Deno.readTextFile(filePath);
    const contentType = getContentType(path);

    return new Response(content, {
      status: 200,
      headers: {
        "Content-Type": contentType,
      },
    });
  } catch (_error) {
    return new Response("Not Found", {
      status: 404,
    });
  }
}

/**
 * Get content type based on file extension
 */
export function getContentType(path: string): string {
  if (path.endsWith(".html")) return "text/html; charset=utf-8";
  if (path.endsWith(".css")) return "text/css";
  if (path.endsWith(".js")) return "application/javascript";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".ico")) return "image/x-icon";
  return "text/plain";
}
