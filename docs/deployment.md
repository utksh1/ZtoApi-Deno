# 🚀 Deployment

ZaiProxy can be deployed in multiple ways to suit your needs.

## ☁️ Deno Deploy

Super easy deployment to the cloud!

- 📤 Push your repository containing main.ts to GitHub
- 🏗️ Create a new project on Deno Deploy and connect the repo
- ⚙️ Set environment variables (DEFAULT_KEY, ZAI_TOKEN, DEFAULT_LANGUAGE, DEBUG_MODE, etc)

## 🏠 Self-hosted / Local

Run it right on your machine!

**Prerequisites**: Install Deno (if you haven't already!)

Start locally:

```bash
deno run --allow-net --allow-env --allow-read main.ts
```

Default port: 9090 (override with PORT env var)

## 🐳 Optional: Compile or Docker

Want to compile it or use Docker?

```bash
deno compile --allow-net --allow-env --allow-read --output ztoapi src/server/router.ts
```

Dockerfile example:

```dockerfile
FROM denoland/deno:latest
WORKDIR /app
COPY . .
EXPOSE 9090
CMD ["deno", "run", "--allow-net", "--allow-env", "--allow-read", "src/server/router.ts"]
```

Build and run:

```bash
docker build -t ztoapi .
docker run -p 9090:9090 -e DEFAULT_KEY="sk-your-key" ztoapi
```

For more advanced deployment options, see [Advanced](../docs/advanced.md).
