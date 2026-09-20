/**
 * Request statistics tracking
 */

import type { LiveRequest, RequestStats } from "../types/definitions.ts";

// Global stats
export let stats: RequestStats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  lastRequestTime: new Date(),
  averageResponseTime: 0,
};

// Live requests tracking (last 100)
export let liveRequests: LiveRequest[] = [];

/**
 * Record request statistics
 */
export function recordRequestStats(startTime: number, _path: string, status: number): void {
  const duration = Date.now() - startTime;

  stats.totalRequests++;
  if (status >= 200 && status < 300) {
    stats.successfulRequests++;
  } else {
    stats.failedRequests++;
  }
  stats.lastRequestTime = new Date();

  // Update average response time
  stats.averageResponseTime = (stats.averageResponseTime * (stats.totalRequests - 1) + duration) / stats.totalRequests;
}

/**
 * Add a live request to tracking
 */
export function addLiveRequest(
  method: string,
  path: string,
  status: number,
  duration: number,
  userAgent: string,
  model?: string,
  tokens?: { prompt?: number; completion?: number; total?: number },
  error?: string,
): LiveRequest {
  const request: LiveRequest = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date(),
    method,
    path,
    status,
    duration,
    userAgent,
    model,
    tokens,
    error,
  };

  liveRequests.unshift(request);

  // Keep only last 100 requests
  if (liveRequests.length > 100) {
    liveRequests = liveRequests.slice(0, 100);
  }

  broadcastTelemetry("request", request);
  broadcastTelemetry("stats", stats);

  return request;
}

/**
 * WebSocket clients connected for live telemetry
 */
const wsClients = new Set<WebSocket>();

export function addWsClient(ws: WebSocket): void {
  wsClients.add(ws);
  ws.onopen = () => {
    ws.send(JSON.stringify({ type: "init", stats, requests: liveRequests }));
  };
  ws.onclose = () => wsClients.delete(ws);
  ws.onerror = () => wsClients.delete(ws);
  // If already open, send immediately
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "init", stats, requests: liveRequests }));
  }
}

function broadcastTelemetry(type: string, data: unknown): void {
  if (wsClients.size === 0) return;
  const payload = JSON.stringify({ type, data });
  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(payload);
      } catch {
        wsClients.delete(client);
      }
    }
  }
}

/**
 * Update a live request by ID (e.g. when streaming finishes)
 */
export function updateLiveRequest(id: string, updates: Partial<LiveRequest>): void {
  const req = liveRequests.find((r) => r.id === id);
  if (req) {
    Object.assign(req, updates);
    broadcastTelemetry("update_request", { id, updates });
  }
}

/**
 * Reset statistics
 */
export function resetStats(): void {
  stats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    lastRequestTime: new Date(),
    averageResponseTime: 0,
  };
  liveRequests = [];
}

/**
 * Get live requests data as JSON string
 */
export function getLiveRequestsData(): string {
  try {
    if (!Array.isArray(liveRequests)) {
      liveRequests = [];
    }

    const requestData = liveRequests.map((req) => ({
      id: req.id || "",
      method: req.method || "",
      path: req.path || "",
      status: req.status || 0,
      duration: req.duration || 0,
      timestamp: req.timestamp || new Date(),
      user_agent: req.userAgent || "",
      model: req.model || null,
      tokens: req.tokens || null,
      error: req.error || null,
    }));

    return JSON.stringify(requestData);
  } catch (_error) {
    return JSON.stringify([]);
  }
}

/**
 * Get stats data as JSON string
 */
export function getStatsData(): string {
  try {
    if (!stats) {
      stats = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        lastRequestTime: new Date(),
        averageResponseTime: 0,
      };
    }

    const statsData = {
      totalRequests: stats.totalRequests || 0,
      successfulRequests: stats.successfulRequests || 0,
      failedRequests: stats.failedRequests || 0,
      averageResponseTime: stats.averageResponseTime || 0,
    };

    return JSON.stringify(statsData);
  } catch (_error) {
    return JSON.stringify({
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
    });
  }
}
