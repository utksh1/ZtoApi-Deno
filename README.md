# 🚀 ZaiProxy - Z.ai Proxy with Session Support! 🌟

> ✅ **SESSION-BASED AUTHENTICATION** - Unlimited usage with JWT tokens from chat.z.ai web interface!

![Deno](https://img.shields.io/badge/deno-v1.40+-blue.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.0+-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![CI](https://img.shields.io/badge/CI-passing-brightgreen.svg)
![Code Quality](https://img.shields.io/badge/code%20quality-A+-brightgreen.svg)

> 🎓 For personal, non-commercial or educational use only. Please use responsibly! 🌈

Hey there! 👋 Welcome to ZaiProxy - your ultimate Z.ai proxy that brings GLM models to life through BOTH OpenAI AND Anthropic Claude compatible interfaces! ✨ Now with **session-based authentication** for unlimited usage using JWT tokens from chat.z.ai! Built with Deno's native HTTP API, it supports streaming/non-streaming responses for both APIs, plus comes with a real-time monitoring dashboard! 😍

## 🎯 **DUAL API SUPPORT** - Use Either Format!

### 🔥 **OpenAI Compatible** → `/v1/` endpoints

### 🎭 **Anthropic Claude Compatible** → `/anthropic/v1/` endpoints

**Use your existing OpenAI OR Claude clients without any changes!** 🚀

## 🌟 Key Features

- 🔑 **Session-based authentication** — unlimited usage with JWT tokens from chat.z.ai! 🚀
  - **4 authentication modes**: JWT (recommended), Session Cookie, API Token, Anonymous
  - **No quota limits** — use your web session for unlimited access
  - **Auto-detection** — automatically selects the best auth method
- 🔄 **OpenAI API fully compatible** — use your existing OpenAI clients seamlessly! 🎯
- 🎭 **Anthropic Claude API fully compatible** — use Claude Desktop, cline, cursor, and any Claude tools! 🤖
- 🛠️ **Native tool calling support** — AI can execute server-side functions! 🔧
  - **Built-in tools**: `get_current_time`, `fetch_url`, `hash_string`, `calculate_expression`
  - **Multiple formats**: JSON, XML, and simple function call syntax detection
  - **Streaming & non-streaming**: Full support for both response modes
  - **Easy extensibility**: Add custom tools via simple registry system
  - **Security-first**: Whitelist-based registry with input validation
  - **Full OpenAI compatibility**: Standard `tools` and `tool_choice` parameters
- 🌊 **SSE streaming support** for both APIs - real-time token delivery! ✨
- 🧠 **Advanced thinking content processing** with 5 amazing modes
- 📊 **Built-in web Dashboard** with live request stats for both APIs! 🎨
- ⚙️ **Configurable via environment variables** - make it yours! 🎛️
- 🚀 **Deployable on Deno Deploy or self-hosted** - your choice! 🏠

## 🤖 Supported Models

See [Models](./docs/models.md) for a complete list of supported models and their capabilities.

## 🔌 **API Endpoints Overview**

### **OpenAI Compatible Endpoints** 🔥

```
GET  /v1/models                    # List available models
POST /v1/chat/completions          # Chat completions (streaming & non-streaming)
                                     # Supports tool calling with `tools` parameter
```

### **Anthropic Claude Compatible Endpoints** 🎭

```
GET  /anthropic/v1/models          # List available Claude models
POST /anthropic/v1/messages        # Messages (streaming & non-streaming)  
POST /anthropic/v1/messages/count_tokens  # Count tokens in messages
```

### **Dashboard & Monitoring** 📊

```
GET  /                             # Welcome page & overview
GET  /dashboard                    # Real-time API monitoring dashboard
GET  /docs                         # API documentation
```

Base paths:

- OpenAI: http://localhost:9090/v1 🌐
- Claude: http://localhost:9090/anthropic/v1 🎭

## 🚀 Quick Start

### Recommended: JWT Token Authentication (Unlimited Usage!)

1. **Get your JWT token from chat.z.ai**:
   - Open https://chat.z.ai in your browser
   - Open Developer Tools (F12)
   - Go to Console tab
   - Type: `localStorage.getItem('token')`
   - Copy the token (starts with `eyJ...`)

2. **Set Environment Variable**:
   ```bash
   export ZAI_JWT_TOKEN="eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9..."
   ```

3. **Run the server**:
   ```bash
   deno run --allow-net --allow-env --allow-read main.ts
   ```

### Alternative: API Token (Limited by quota)

1. Visit https://chat.z.ai and get your API token
2. Set `ZAI_TOKEN` environment variable
3. Run the server

For detailed setup instructions, see [Getting Started](./docs/getting-started.md).

## 🛠️ Tool Calling Example

Include tools in your API requests and let the AI use them automatically:

```bash
curl -X POST http://localhost:9090/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_OR_API_TOKEN" \
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

**Available built-in tools:**

- `get_current_time` - Returns current UTC time
- `fetch_url` - Fetches content from URLs (text/JSON)
- `hash_string` - Calculates SHA256/SHA1 hashes
- `calculate_expression` - Safely evaluates math expressions

See [Native Tool Calling](./docs/native-tool-calling.md) for complete documentation.

## 📚 Detailed Documentation

For comprehensive information, see our detailed documentation:

- [🚀 Getting Started](./docs/getting-started.md) - Setup and first steps
- [🚀 Deployment](./docs/deployment.md) - Cloud and local deployment
- [🔌 API Reference](./docs/api-reference.md) - Complete API documentation
- [🤖 Models](./docs/models.md) - Model capabilities and mappings
- [✨ Features](./docs/features.md) - Advanced features and configuration
- [💻 Examples](./docs/examples.md) - Usage examples with multiple languages
- [🔧 Troubleshooting](./docs/troubleshooting.md) - Common issues and solutions
- [🔬 Advanced](./docs/advanced.md) - Technical implementation details
- [🛠️ Native Tool Calling](./docs/native-tool-calling.md) - Tool calling system guide

## 🏗️ Architecture

ZaiProxy features a **modular architecture** with session-based authentication:

```
src/
├── auth/         # Authentication (JWT, session cookies, API tokens)
├── config/       # Configuration & constants
├── services/     # Business logic (hybrid client, session manager, token pool)
├── types/        # TypeScript type definitions
└── utils/        # Utility functions (logging, stats, helpers)
```

**Authentication Modes:**

- **JWT** (recommended): Unlimited usage with web session token
- **Session Cookie**: Alternative web session format
- **API Token**: Traditional API key (quota-limited)
- **Anonymous**: Guest access (limited responses)

**For developers:**

- [🤖 AGENTS.md](./AGENTS.md) - Development guide and architecture overview for AI agents
- [📚 Full Documentation](./docs/README.md) - Comprehensive guides and API reference

## 🤝 Contributing

Want to help make ZaiProxy even better? We'd love your help! 💪

**Development Workflow:**

```bash
deno task dev      # Run with watch mode
deno task test     # Run tests
deno task lint     # Lint code
deno task fmt      # Format code
deno task check    # Type check
```

- Open issues and pull requests on the project repository 🎉
- Follow [AGENTS.md](./AGENTS.md) for code style and development conventions
- All PRs automatically run CI checks (lint, format, type check, tests)

## 📜 License

This project is released under the MIT License. See LICENSE for details. 📄

---

## 🌈 Thanks for reading!

Hope you enjoy using ZaiProxy as much as we enjoyed building it! If you have any questions or feedback, don't hesitate to reach out! 🤗✨

Happy coding! (´｡• ᵕ •｡`) 💖

## 🙏 Acknowledgments

Special thanks to the amazing open-source community! This project was inspired by and includes code adapted from:

- **[claude-proxy](https://github.com/simpx/claude-proxy)** by [simpx](https://github.com/simpx) - Claude API proxy implementation patterns and Anthropic API structure. Their excellent work provided the foundation for our Claude API compatibility layer! 🎭✨
- **[conduit](https://github.com/utksh1/conduit)** - Session-based authentication architecture for ChatGPT web interface. Inspired our JWT and session cookie authentication system! 🔑✨

## 🌟 Key Contributors

**🚀 MASSIVE THANKS TO THE HEROES WHO SAVED THIS PROJECT:**

- **🏆 [@sarices (ZhengWeiDong)](https://github.com/sarices) - THE ABSOLUTE LEGEND** 🔥🔥🔥
  - **🎯 SINGLE-HANDEDLY FIXED Z.ai upstream authentication** - WITHOUT HIM THIS PROJECT WOULD BE BROKEN!
  - **⚡ IMPLEMENTED Base64 encoding signature algorithm** - Critical fix that restored ALL API functionality
  - **🛠️ RESOLVED the dreaded "502 Bad Gateway" errors** - Both OpenAI AND Anthropic endpoints now work flawlessly
  - **💡 PR**: [feat(api): update signature algorithm to align with upstream](https://github.com/roseforyou/ZtoApi/pull/6)
  - **🎖️ IMPACT**: This genius-level contribution literally SAVED the entire project! 🙌✨
  - **🏅 HERO STATUS**: ZhengWeiDong (Z.ai upstream fixing) - WE OWE YOU EVERYTHING! 🎉

_This man deserves a medal! Without @sarices, none of this would work! 🏆_
