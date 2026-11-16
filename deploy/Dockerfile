# VideoHub fork for Claude Code cloud sessions: builds from this repository's own code.
# Build context is the repository root (see docker-compose*.yml).
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends chromium ffmpeg git curl ca-certificates fonts-dejavu fonts-noto-color-emoji \
 && rm -rf /var/lib/apt/lists/*
# Chrome inside a container: no Linux sandbox (the container is the sandbox). Applies to every chromium launch.
RUN printf 'export CHROMIUM_FLAGS="$CHROMIUM_FLAGS --no-sandbox --disable-dev-shm-usage"\n' > /etc/chromium.d/zz-container
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY . /app
COPY deploy/gateway.mjs /opt/gateway.mjs
COPY deploy/start.sh /opt/start.sh
# Windows checkouts may add CRLF: strip it so the scripts run on Linux
RUN sed -i "s/\r$//" /opt/start.sh /opt/gateway.mjs && chmod +x /opt/start.sh && mkdir -p /data && chown -R node:node /app /data
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s CMD curl -s -o /dev/null http://127.0.0.1:7788/ || exit 1
CMD ["/opt/start.sh"]
