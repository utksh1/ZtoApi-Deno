/**
 * Unit tests for ZtoApi modules
 */

import { assertEquals, assertExists } from "@std/assert";
import { CONFIG } from "../src/config/constants.ts";
import { getModelConfig, SUPPORTED_MODELS } from "../src/config/models.ts";
import { logger } from "../src/utils/logger.ts";
import { setCORSHeaders, truncateString } from "../src/utils/helpers.ts";
import { transformThinking } from "../src/utils/stream.ts";

Deno.test("CONFIG constants are defined", () => {
  assertExists(CONFIG.DEFAULT_PORT);
  assertExists(CONFIG.MAX_RETRY_ATTEMPTS);
  assertExists(CONFIG.RETRY_DELAY_MS);
  assertEquals(typeof CONFIG.DEFAULT_PORT, "number");
  assertEquals(typeof CONFIG.MAX_RETRY_ATTEMPTS, "number");
  assertEquals(typeof CONFIG.RETRY_DELAY_MS, "number");
});

Deno.test("SUPPORTED_MODELS is not empty", () => {
  assertExists(SUPPORTED_MODELS);
  assertEquals(Array.isArray(SUPPORTED_MODELS), true);
  assertEquals(SUPPORTED_MODELS.length > 0, true);
});

Deno.test("getModelConfig returns valid config", () => {
  const config = getModelConfig("GLM-5.3-Flash");
  assertExists(config);
  assertExists(config.id);
  assertExists(config.name);
  assertExists(config.upstreamId);
  assertExists(config.capabilities);
});

Deno.test("logger functions exist", () => {
  assertExists(logger.debug);
  assertExists(logger.info);
  assertExists(logger.warn);
  assertExists(logger.error);
  assertEquals(typeof logger.debug, "function");
  assertEquals(typeof logger.info, "function");
  assertEquals(typeof logger.warn, "function");
  assertEquals(typeof logger.error, "function");
});

Deno.test("truncateString works correctly", () => {
  assertEquals(truncateString("hello world"), "hello world");
  assertEquals(truncateString("hi"), "hi");
  assertEquals(truncateString(""), "");
  // Test with very long string (default max is 50)
  const longString = "a".repeat(100);
  assertEquals(truncateString(longString).length, 53); // 50 + "..."
});

Deno.test("setCORSHeaders sets correct headers", () => {
  const headers = new Headers();
  setCORSHeaders(headers);

  assertEquals(headers.get("Access-Control-Allow-Origin"), "*");
  assertEquals(headers.get("Access-Control-Allow-Methods"), "GET, POST, OPTIONS");
  assertExists(headers.get("Access-Control-Allow-Headers"));
  assertEquals(headers.get("Access-Control-Allow-Credentials"), "true");
});

Deno.test("Model capabilities detection", () => {
  const glmFlash = getModelConfig("GLM-5.3-Flash");
  assertEquals(glmFlash.capabilities.thinking, true);
  assertEquals(glmFlash.capabilities.mcp, true);
  assertEquals(glmFlash.capabilities.vision, true);

  const glm53 = getModelConfig("GLM-5.3");
  assertEquals(glm53.capabilities.thinking, true);
  assertEquals(glm53.capabilities.mcp, true);
});

Deno.test("transformThinking - strip mode", () => {
  const content = "<think>thinking</think>content";
  const result = transformThinking(content, "strip");
  assertEquals(result, "content");
});

Deno.test("transformThinking - thinking mode", () => {
  const content = "<think>thinking</think>content";
  const result = transformThinking(content, "thinking");
  assertEquals(result, "<thinking>thinking</thinking>content");
});

Deno.test("transformThinking - think mode", () => {
  const content = "<think>thinking</think>content";
  const result = transformThinking(content, "think");
  assertEquals(result, content);
});

Deno.test("transformThinking - raw mode", () => {
  const content = "<think>thinking</think>content";
  const result = transformThinking(content, "raw");
  assertEquals(result, content);
});

Deno.test("transformThinking - separate mode", () => {
  const content = "<think>thinking</think>content";
  const result = transformThinking(content, "separate");
  assertEquals(result, { reasoning: "thinking", content: "content" });
});

Deno.test("transformThinking - empty content", () => {
  const content = "";
  const resultStrip = transformThinking(content, "strip");
  assertEquals(resultStrip, "");
  const resultSeparate = transformThinking(content, "separate");
  assertEquals(resultSeparate, { reasoning: "", content: "" });
});

Deno.test("transformThinking - no tags", () => {
  const content = "just content";
  const resultStrip = transformThinking(content, "strip");
  assertEquals(resultStrip, "just content");
  const resultSeparate = transformThinking(content, "separate");
  assertEquals(resultSeparate, { reasoning: "", content: "just content" });
});

Deno.test("transformThinking - partial think tag", () => {
  const content = "thinking</think>content";
  const result = transformThinking(content, "strip");
  assertEquals(result, "thinking</think>content");
});
