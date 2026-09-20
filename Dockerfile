# Production Dockerfile for ZaiProxy
FROM denoland/deno:latest

WORKDIR /app

# Copy configuration and lock files
COPY deno.json deno.lock* ./

# Copy all application files
COPY . .

# Pre-cache dependencies and application entrypoint
RUN deno cache src/server/router.ts

# Default port for Render / Cloud hosts (Render injects $PORT)
ENV PORT=10000
EXPOSE 10000 9090

CMD ["deno", "run", "-A", "src/server/router.ts"]