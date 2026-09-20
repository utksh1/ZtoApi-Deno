# 🚀 Getting Started

This guide will help you set up ZaiProxy and make your first API call.

## 🔑 Authentication Options

ZaiProxy supports **4 authentication modes**:

### 1. JWT Token (Recommended - Unlimited Usage!)

Get unlimited access using your web session token:

1. 🌐 Visit https://chat.z.ai and log in
2. 🔍 Open Developer Tools (F12) → Console tab
3. 💻 Type: `localStorage.getItem('token')`
4. 📋 Copy the token (starts with `eyJ...`)
5. ⚙️ Set environment variable:
   ```bash
   export ZAI_JWT_TOKEN="eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9..."
   ```

### 2. Session Cookie (Alternative Web Session)

Extract session cookie from browser:

1. 🌐 Visit https://chat.z.ai and log in
2. 🔍 Open Developer Tools (F12) → Application/Storage tab
3. 🍪 Find cookies for chat.z.ai
4. 📋 Copy the session cookie value
5. ⚙️ Set environment variable:
   ```bash
   export ZAI_SESSION_TOKEN="your_session_cookie"
   ```

### 3. API Token (Traditional - Quota Limited)

Use official API token (limited by quota):

1. 🌐 Visit https://chat.z.ai and get your API token
2. ⚙️ Set environment variable:
   ```bash
   export ZAI_TOKEN="your_api_token"
   ```

### 4. Anonymous (Guest Access - Limited)

No configuration needed, but responses may be limited.

## ⚙️ Environment Variables

Customize your experience with these settings:

- `ZAI_JWT_TOKEN` — JWT token from chat.z.ai (recommended for unlimited usage) 🔑
- `ZAI_SESSION_TOKEN` — Session cookie from browser (alternative) 🍪
- `ZAI_TOKEN` — Official Z.ai API token (quota-limited) 🎟️
- `DEFAULT_KEY` — API key for clients (default: sk-your-key) 🔑
- `UPSTREAM_URL` — Upstream Z.ai endpoint (default: https://chat.z.ai/api/chat/completions) 🔗
- `DEBUG_MODE` — Enable debug logs (true/false, default: true) 🐛
- `DEFAULT_STREAM` — Default streaming mode (true/false, default: true) 🌊
- `DASHBOARD_ENABLED` — Enable dashboard (true/false, default: true) 📊
- `PORT` — Server port (default: 9090) 🌐
- `DEFAULT_LANGUAGE` — Default language for Accept-Language headers (default: en-US) 🌍
- `ZAI_SIGNING_SECRET` — Custom key for request signature generation (optional) 🔐

## 🔐 New Features and Configuration

### Session-Based Authentication

ZaiProxy now supports session-based authentication like Conduit for ChatGPT. Use JWT tokens or session cookies from chat.z.ai for unlimited usage without API quota limits.

### Enhanced Request Signature

ZaiProxy uses an updated dual-layer HMAC-SHA256 signature algorithm with Base64 encoding for enhanced security. Set `ZAI_SIGNING_SECRET` to customize the signature key. For detailed information, see [signature-update-guide.md](../signature-update-guide.md).

### Token Pool Management

The server includes automatic token pool management for handling API tokens efficiently, supporting anonymous access and token rotation. This feature is enabled by default and requires no additional configuration.

### Multimodal Support

Enhanced support for images, videos, documents, and audio in requests. Works with all authentication modes.

## 🧪 Quick Local Test

Let's test it out!

**OpenAI API:**

```bash
curl http://localhost:9090/v1/models
```

```bash
curl -X POST http://localhost:9090/v1/chat/completions \
-H "Content-Type: application/json" \
-H "Authorization: Bearer sk-your-local-key" \
-d '{"model":"GLM-4-6-API-V1","messages":[{"role":"user","content":"Hello"}],"stream":false}'
```

**Claude API:**

```bash
curl http://localhost:9090/anthropic/v1/models
```

```bash
curl -X POST http://localhost:9090/anthropic/v1/messages \
-H "Content-Type: application/json" \
-H "x-api-key: sk-your-local-key" \
-d '{"model":"claude-3-5-sonnet-20241022","max_tokens":100,"messages":[{"role":"user","content":"Hello Claude!"}]}'
```

## 🛠️ Getting Started with Tool Calling

ZaiProxy includes native tool calling support that allows AI models to execute server-side functions. Here's how to get started:

### Basic Tool Calling Example

```bash
curl -X POST http://localhost:9090/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-your-local-key" \
  -d '{
    "model": "GLM-4.5",
    "messages": [{"role": "user", "content": "What time is it?"}],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "get_current_time",
          "description": "Get current UTC time"
        }
      }
    ],
    "tool_choice": "auto"
  }'
```

### Available Built-in Tools

- **`get_current_time`** - Returns current UTC time
- **`fetch_url`** - Fetches content from URLs (text/JSON)
- **`hash_string`** - Calculates SHA256/SHA1 hashes
- **`calculate_expression`** - Safely evaluates math expressions

### Python Example

```python
import openai

client = openai.OpenAI(
    api_key="sk-your-local-key",
    base_url="http://localhost:9090/v1"
)

response = client.chat.completions.create(
    model="GLM-4.5",
    messages=[{"role": "user", "content": "Calculate 2+2"}],
    tools=[
        {
            "type": "function",
            "function": {
                "name": "calculate_expression",
                "description": "Calculate mathematical expressions",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "expression": {"type": "string"}
                    },
                    "required": ["expression"]
                }
            }
        }
    ],
    tool_choice="auto"
)

print(response.choices[0].message.content)
```

### Adding Custom Tools

You can add custom tools by modifying `src/services/init-tools.ts`:

```typescript
import { registerTool } from "./tool-registry.ts";

registerTool(
  "my_custom_tool",
  async function (args: { message: string }) {
    return `Echo: ${args.message}`;
  },
  "Echoes back the message",
  {
    type: "object",
    properties: { message: { type: "string" } },
    required: ["message"],
  },
);
```

For complete documentation, see [Native Tool Calling](./native-tool-calling.md).

For more examples, see [Examples](../docs/examples.md).
