# Forged runtime image: every project VM (preview and published app) boots from it.
# - Node.js + the starter template's dependencies, pre-installed so `next dev` starts in seconds
# - Headless Chromium + Forged's in-VM tools (virtual-mouse browser, page audit)
# Default base: the official Playwright image (browsers + system libraries included).
ARG BASE_IMAGE=mcr.microsoft.com/playwright:v1.64.1-noble
FROM ${BASE_IMAGE}

ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=development \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    npm_config_update_notifier=false \
    npm_config_fund=false \
    npm_config_audit=false

# Install Chromium when the base image doesn't ship it (e.g. node:22-bookworm-slim).
RUN if ! ls -d /ms-playwright/chromium-* >/dev/null 2>&1; then npx -y playwright@1.64.1 install --with-deps chromium; fi \
  && (rm -rf /ms-playwright/firefox-* /ms-playwright/webkit-* || true)

# Unprivileged sandbox user with a high UID that never overlaps host users.
RUN useradd --uid 10001 --create-home --shell /usr/sbin/nologin sandbox

WORKDIR /opt/forged
COPY forged-tools/package.json ./package.json
RUN npm install --omit=dev
COPY forged-tools/*.mjs ./

WORKDIR /app
COPY template/package.json ./package.json
RUN npm install && chown -R sandbox:sandbox /app /home/sandbox

USER sandbox
EXPOSE 3000
CMD ["sleep", "infinity"]
