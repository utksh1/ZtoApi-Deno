#!/bin/sh
set -e

echo "[INIT] Starting Headless Chromium on port 9222..."
/usr/bin/chromium \
  --headless=new \
  --no-sandbox \
  --disable-setuid-sandbox \
  --disable-dev-shm-usage \
  --disable-gpu \
  --disable-software-rasterizer \
  --disable-blink-features=AutomationControlled \
  --disable-extensions \
  --no-first-run \
  --no-default-browser-check \
  --remote-debugging-port=9222 \
  --remote-debugging-address=127.0.0.1 \
  --user-data-dir=/tmp/chrome-profile \
  --js-flags="--max-old-space-size=256" \
  --user-agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36" \
  about:blank > /tmp/chromium.log 2>&1 &

CHROME_PID=$!

echo "[INIT] Waiting for Chromium CDP to be ready on 127.0.0.1:9222..."
for i in $(seq 1 30); do
  if curl -s -f http://127.0.0.1:9222/json/version > /dev/null 2>&1; then
    echo "[INIT] Chromium CDP ready after ${i} checks!"
    break
  fi
  sleep 0.2
done

echo "[INIT] Starting ZaiProxy on port ${PORT:-10000}..."
exec deno run -A src/server/router.ts
