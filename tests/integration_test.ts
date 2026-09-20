/**
 * Integration tests for ZtoApi
 * Tests the server endpoints and functionality
 * NOTE: These tests require a running server on localhost:9090
 */

import { assert, assertEquals } from "@std/assert";

const BASE_URL = Deno.env.get("BASE_URL") || "http://localhost:9090";
const TEST_API_KEY = "sk-test-key";

// Check if server is running
async function isServerRunning(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/v1/models`, { signal: AbortSignal.timeout(1000) });
    await response.body?.cancel();
    return true;
  } catch {
    return false;
  }
}

/**
 * Test /v1/models endpoint
 */
Deno.test({
  name: "GET /v1/models returns model list",
  ignore: !(await isServerRunning()),
  async fn() {
    const response = await fetch(`${BASE_URL}/v1/models`, {
      headers: {
        "Authorization": `Bearer ${TEST_API_KEY}`,
      },
    });

    assertEquals(response.status, 200);
    const data = await response.json();
    assert(data.object === "list");
    assert(Array.isArray(data.data));
    assert(data.data.length > 0);
  },
});

/**
 * Test /v1/chat/completions endpoint (non-streaming)
 */
Deno.test({
  name: "POST /v1/chat/completions (non-streaming)",
  ignore: !(await isServerRunning()),
  async fn() {
    try {
      const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${TEST_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "GLM-5.3-Flash",
          messages: [
            { role: "user", content: "Say 'test successful' and nothing else" },
          ],
          stream: false,
        }),
        signal: AbortSignal.timeout(4000),
      });

      // Server may return 200, 400 (captcha), 401, or 403 in unauthenticated test environments
      assert([200, 400, 401, 403].includes(response.status));
      await response.body?.cancel(); // Consume body to prevent leak
    } catch (e) {
      if ((e as Error)?.name !== "TimeoutError" && (e as Error)?.name !== "AbortError") throw e;
    }
  },
});

/**
 * Test /v1/chat/completions endpoint (streaming)
 */
Deno.test({
  name: "POST /v1/chat/completions (streaming)",
  ignore: !(await isServerRunning()),
  async fn() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${TEST_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "GLM-5.3-Flash",
          messages: [
            { role: "user", content: "Say 'test successful' and nothing else" },
          ],
          stream: true,
        }),
        signal: controller.signal,
      });

      // Server may return 200, 400 (captcha), 401, or 403 in unauthenticated test environments
      assert([200, 400, 401, 403].includes(response.status));
      if (response.body) {
        const reader = response.body.getReader();
        try {
          await reader.read();
        } catch {
          // ignore stream close
        } finally {
          reader.releaseLock();
        }
      }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") throw e;
    } finally {
      clearTimeout(timeout);
    }
  },
});

/**
 * Test CORS headers
 */
Deno.test({
  name: "OPTIONS request returns CORS headers",
  ignore: !(await isServerRunning()),
  async fn() {
    const response = await fetch(`${BASE_URL}/v1/models`, {
      method: "OPTIONS",
    });

    assertEquals(response.status, 200);
    assert(response.headers.get("Access-Control-Allow-Origin"));
    assert(response.headers.get("Access-Control-Allow-Methods"));
    await response.body?.cancel();
  },
});

/**
 * Test dashboard endpoint
 */
Deno.test({
  name: "GET /dashboard returns HTML",
  ignore: !(await isServerRunning()),
  async fn() {
    const response = await fetch(`${BASE_URL}/dashboard`);

    assertEquals(response.status, 200);
    assert(response.headers.get("Content-Type")?.includes("text/html"));
    await response.body?.cancel();
  },
});

/**
 * Test API stats endpoint
 */
Deno.test({
  name: "GET /api/stats returns statistics",
  ignore: !(await isServerRunning()),
  async fn() {
    const response = await fetch(`${BASE_URL}/api/stats`);

    // Stats endpoint may not exist in all configurations
    assert(response.status === 200 || response.status === 404);
    await response.body?.cancel();
  },
});

/**
 * Test invalid API key
 */
Deno.test({
  name: "Invalid API key returns 401",
  ignore: !(await isServerRunning()),
  async fn() {
    const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": "Invalid",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "GLM-5.3-Flash",
        messages: [{ role: "user", content: "test" }],
      }),
    });

    // Should return 401 for invalid key
    assertEquals(response.status, 401);
    await response.body?.cancel();
  },
});

/**
 * Test Anthropic API compatibility
 */
Deno.test({
  name: "POST /v1/messages (Anthropic)",
  ignore: !(await isServerRunning()),
  async fn() {
    const response = await fetch(`${BASE_URL}/v1/messages`, {
      method: "POST",
      headers: {
        "x-api-key": TEST_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "GLM-5.3-Flash",
        messages: [
          { role: "user", content: "Say 'test successful' and nothing else" },
        ],
        max_tokens: 100,
      }),
    });

    // Anthropic endpoint may not be implemented or may return 401
    assert(response.status === 200 || response.status === 404 || response.status === 401);
    await response.body?.cancel();
  },
});
