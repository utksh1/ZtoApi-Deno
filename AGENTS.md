# AGENTS.md - ZaiProxy Development Guide

This file provides essential information for agents working on the ZaiProxy codebase. It includes build/lint/test commands, code style guidelines, and an overview of the project's structure and design.

## Build, Lint, and Test Commands

### Running the Application

- **Start the server**: `deno task start`
- **Development mode (with watch)**: `deno task dev`

### Testing

- **Run all tests**: `deno task test`
- **Run quick tests**: `deno task test:quick`
- **Run verbose tests**: `deno task test:verbose`
- **Run unit tests only**: `deno task test:unit`
- **Run integration tests only**: `deno task test:integration`
- **Run smoke tests only**: `deno task test:smoke`
- **Check TypeScript types**: `deno task check`

### Linting and Code Quality

- **Lint the code**: `deno task lint`
- **Format code**: `deno task fmt`
- **Check formatting**: `deno task fmt:check`

### Notes

- All commands require network, environment, and read permissions as the app interacts with external APIs and reads configuration.
- For running a single test file, use `deno test <file_path>` where `<file_path>` is the path to the specific test file (e.g., `main_test.ts`).
- Use `deno task test` for comprehensive testing including unit and integration tests.
- **IMPORTANT**: Always run `deno task test` before completing any work to ensure all tests pass and code quality is maintained.

## Code Style Guidelines

### Language and Framework

- **Language**: TypeScript with strict mode enabled (`"strict": true` in `deno.json`).
- **Runtime**: Deno (no Node.js dependencies).
- **Style**: Follow Deno's conventions and use TypeScript best practices.

### Formatting and Structure

- **Indentation**: Use 2 spaces (Deno default).
- **Line endings**: Unix-style (LF).
- **File encoding**: UTF-8.
- **Semicolons**: Required (configured in deno.json).
- **Quotes**: Use double quotes for strings.

### Naming Conventions

- **Variables and functions**: camelCase (e.g., `debugLog`, `getModelConfig`).
- **Constants**: UPPER_SNAKE_CASE (e.g., `DEFAULT_MODEL`, `THINK_TAGS_MODE`).
- **Classes and interfaces**: PascalCase (e.g., `AnthropicMessagesRequest`, `ModelConfig`).
- **Files**: kebab-case for multi-word files (e.g., `router.ts`, `upstream-client.ts`).

### Comments and Documentation

- **JSDoc comments**: Required for all public functions, interfaces, and complex logic. Include `@param`, `@returns`, and descriptions.
- **Inline comments**: Use `//` for single-line comments. Avoid excessive comments; code should be self-explanatory.
- **Block comments**: Use `/* */` for multi-line comments if needed.

### Imports

- **Standard library**: Import from JSR (e.g., `import { decodeBase64 } from "@std/encoding/base64";`).
- **Local modules**: Use relative paths (e.g., `import { convertAnthropicToOpenAI } from "../anthropic/core.ts";`).
- **NPM packages**: Use `npm:` prefix (e.g., `"gpt-tokenizer": "npm:gpt-tokenizer@^3.0.2"` in `deno.json`).
- **Group imports**: Standard library first, then local, then NPM.

### Types and Interfaces

- **Explicit types**: Always use TypeScript types. Avoid `any` unless necessary.
- **Interface definitions**: Define interfaces for API requests/responses and complex objects.
- **Union types**: Use for optional or variant types (e.g., `string | Array<{ type: string; text?: string; }>`).
- **Generics**: Use for reusable types (e.g., `Record<string, unknown>`).

### Error Handling

- **Try-catch blocks**: Wrap async operations and API calls in try-catch.
- **Custom errors**: Throw descriptive errors with context.
- **Logging**: Use `debugLog` function for debug messages (controlled by `DEBUG_MODE` env var). Use `console.log` for important logs.
- **Graceful degradation**: Handle failures without crashing the server.

### Functions and Methods

- **Async/await**: Prefer over promises for async code.
- **Arrow functions**: Use for simple functions; traditional functions for methods.
- **Parameters**: Use descriptive names and provide defaults where appropriate.
- **Return types**: Explicitly declare return types for functions.

### Security and Best Practices

- **No secrets in code**: Use environment variables for API keys and sensitive data.
- **Input validation**: Validate API inputs and sanitize where possible.
- **CORS**: Properly configure CORS headers for cross-origin requests.
- **Environment checks**: Use `Deno.env.get()` for configuration.
- **Tool security**: Only registered tools can be executed; sandboxed execution environment; parameter validation.

### Example Code Style

```typescript
/**
 * Example function demonstrating style guidelines
 * @param input The input string to process
 * @returns Processed string
 */
function processInput(input: string): string {
  if (!input) {
    throw new Error("Input cannot be empty");
  }

  const result = input.trim().toLowerCase();
  debugLog("Processed input: %s", result);

  return result;
}
```

## Project Structure and Design

### Overview

ZaiProxy is a Deno-based API proxy server that provides OpenAI and Anthropic Claude-compatible interfaces to Z.ai's GLM models. It supports streaming and non-streaming responses, includes a real-time monitoring dashboard, and handles multimodal content (text, images, videos, documents, audio).

### Architecture

- **Runtime**: Deno native HTTP server.
- **API Compatibility**: Dual support for OpenAI (`/v1/`) and Anthropic (`/anthropic/v1/`) endpoints.
- **Upstream**: Proxies requests to Z.ai's API (`https://chat.z.ai/api/chat/completions`).
- **Authentication**: API key validation with optional anonymous token fetching.
- **Streaming**: Server-Sent Events (SSE) for real-time responses.
- **UI**: Built-in web dashboard for monitoring (`/dashboard`).

### Key Components

- **src/server/router.ts**: Core server logic, request handling, routing, and upstream communication.
- **src/anthropic/core.ts**: Anthropic API conversion utilities, model mappings, and token counting.
- **src/handlers/openai.ts**: OpenAI `/v1/chat/completions` endpoint handler.
- **src/handlers/dashboard.ts**: Web dashboard and models endpoint handler.
- **src/services/upstream-client.ts**: Upstream communication and CDP browser bridge routing.
- **UI files** (`ui/`): HTML/CSS/JS for the dashboard and documentation.
- **Tests** (`tests/`): Unit tests for core streaming and utility functions.
- **Configuration**: `deno.json` for tasks and imports; environment variables for runtime config.

### Design Patterns

- **Modular interfaces**: Separate interfaces for OpenAI and Anthropic requests/responses.
- **Conversion layers**: Functions to convert between API formats (e.g., `convertAnthropicToOpenAI`).
- **Configuration-driven**: Model configs and feature flags via constants and env vars.
- **Error propagation**: Centralized error handling with detailed logging.
- **State management**: Global stats and live request tracking for the dashboard.

### Supported Models

- **GLM-5.3-Flash** (`GLM-5.3-Flash`): Flagship fast multimodal model, 1M context window, reasoning effort & thinking.
- **GLM-5.3** (`GLM-5.3`): Frontier reasoning and agentic model, 1M context window.
- **GLM-5.2** (`GLM-5.2`): High-performance reasoning model, 1M context window.

### Key Features

- **Thinking content modes**: `strip`, `thinking`, `think`, `raw`, `separate` for handling model reasoning.
- **Multimodal support**: Process images, videos, documents, and audio in requests.
- **Real-time stats**: Track requests, response times, and errors via global state.
- **Anonymous tokens**: Automatic fetching for unauthenticated requests.
- **Browser bridge**: CDP connection to active browser session for resilient upstream routing.

### Deployment

- **Deno Deploy**: Cloud deployment with environment variables.
- **Self-hosted**: Run locally with Deno runtime.
- **Docker**: Use `Dockerfile` for containerized deployment.

### Maintenance Notes

- Update this file whenever system or design changes occur (e.g., new endpoints, config options, or architectural shifts).
- Ensure all new code adheres to the style guidelines above.
- Run `deno task test` and `deno task lint` before commits to maintain code quality.
