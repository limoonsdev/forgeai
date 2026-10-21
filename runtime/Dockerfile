# Forged runtime image — every project VM boots from this image.
# Node modules for the starter template are baked in so `next dev` starts in seconds.
ARG BASE_IMAGE=node:22-bookworm-slim
FROM ${BASE_IMAGE}

ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=development \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    npm_config_update_notifier=false

WORKDIR /app
COPY template/package.json ./package.json
RUN npm install --no-audit --no-fund \
  && chown -R node:node /app /home/node

USER node
EXPOSE 3000
CMD ["sleep", "infinity"]
