# syntax=docker/dockerfile:1.28@sha256:bb22d9815c728170f72750f4e5b0d672e06176142e1d602c7e66c050100b7e5b
FROM node:24.22.0-slim@sha256:a5f4366e834695d5f363b920c104953a535d3a9864d1bdf74566a0ebe01daee5 AS builder
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

FROM node:24.22.0-slim@sha256:a5f4366e834695d5f363b920c104953a535d3a9864d1bdf74566a0ebe01daee5
ARG IMAGE_VERSION="0.0.0-local"
ARG IMAGE_REVISION="unknown"
LABEL org.opencontainers.image.title="Verii Credentialing Hub" \
  org.opencontainers.image.description="Environment-agnostic Verii Credentialing Hub" \
  org.opencontainers.image.source="https://github.com/LFDT-Verii/core" \
  org.opencontainers.image.url="https://hub.docker.com/r/lfdecentralizedtrust/verii-credentialing-hub" \
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
