# Production Dockerfile for ZaiProxy
FROM denoland/deno:2.0.0

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

CMD ["deno", "run", "--allow-net", "--allow-env", "--allow-read", "src/server/router.ts"]