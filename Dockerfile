# Production Dockerfile for ZaiProxy with Headless Chromium
FROM denoland/deno:latest

WORKDIR /app

# Install Chromium and required fonts/libraries for headless browser bridge
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy configuration and lock files
COPY deno.json deno.lock* ./

# Copy all application files
COPY . .

# Ensure entrypoint is executable
RUN chmod +x ./entrypoint.sh

# Pre-cache dependencies and application entrypoint
RUN deno cache src/server/router.ts

# Default port for Render / Cloud hosts (Render injects $PORT)
ENV PORT=10000 \
    CHROME_BIN=/usr/bin/chromium \
    BROWSER_CDP_URL=http://127.0.0.1:9222

EXPOSE 10000 9090

ENTRYPOINT ["./entrypoint.sh"]