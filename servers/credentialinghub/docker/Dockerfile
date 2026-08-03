# syntax=docker/dockerfile:1.24@sha256:87999aa3d42bdc6bea60565083ee17e86d1f3339802f543c0d03998580f9cb89
FROM node:24.18.0-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d AS builder
ENV PNPM_HOME="/home/node/.local/share/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && ln -sf python3 /usr/bin/python \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@10.34.5 --activate \
  && mkdir -p "${PNPM_HOME}" \
  && chown -R node:node /app "${PNPM_HOME}"
USER node
COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --chown=node:node .husky ./.husky
RUN pnpm fetch --prod
COPY --chown=node:node packages ./packages
COPY --chown=node:node servers ./servers
RUN pnpm --filter @verii/server-credentialing-hub... install --offline --prod --frozen-lockfile
RUN pnpm --filter @verii/server-credentialing-hub --prod deploy --legacy /app/deploy

FROM node:24.18.0-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d
ARG IMAGE_VERSION="0.0.0-local"
ARG IMAGE_REVISION="unknown"
LABEL org.opencontainers.image.title="Verii Credentialing Hub" \
  org.opencontainers.image.description="Environment-agnostic Verii Credentialing Hub" \
  org.opencontainers.image.source="https://github.com/LFDT-Verii/core" \
  org.opencontainers.image.url="https://hub.docker.com/r/verii/credentialing-hub" \
  org.opencontainers.image.licenses="Apache-2.0" \
  org.opencontainers.image.version="${IMAGE_VERSION}" \
  org.opencontainers.image.revision="${IMAGE_REVISION}"
ENV NODE_ENV="production" HOST="0.0.0.0" PORT="3000" LOG_SEVERITY="info"
WORKDIR /app
COPY --chown=node:node --from=builder /app/deploy ./
COPY --chown=node:node --from=builder \
  /app/servers/credentialinghub/docker/entrypoint.js ./docker/entrypoint.js
COPY --chown=node:node --from=builder \
  /app/servers/credentialinghub/docker/resolve-runtime-environment.js \
  ./docker/resolve-runtime-environment.js
COPY --chown=node:node --from=builder \
  /app/servers/credentialinghub/docker/velocity-network-presets.js \
  ./docker/velocity-network-presets.js
USER node
EXPOSE 3000
ENTRYPOINT ["node", "docker/entrypoint.js"]
