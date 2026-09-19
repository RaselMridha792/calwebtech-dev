# syntax=docker/dockerfile:1.7
# Built in GitHub Actions and pulled by the VPS. Never build this on the VPS.
# Build context is the repository root: docker build -f apps/api/Dockerfile .

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

# Dependencies are fetched from the lockfile alone, so this layer survives code changes.
FROM base AS fetch
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm fetch --frozen-lockfile

FROM fetch AS build
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --offline --frozen-lockfile --filter "@calwebtech/api..."
RUN pnpm --filter "@calwebtech/api..." run build
# A self-contained copy of the API with production dependencies only, including the
# compiled @calwebtech/db and @calwebtech/shared packages.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --filter @calwebtech/api deploy --prod --legacy /out

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S -g 1001 app && adduser -S -u 1001 -G app app
COPY --from=build --chown=app:app /out ./
# Schema and committed migrations for `node dist/migrate.js`, the one-off release step.
COPY --from=build --chown=app:app /repo/packages/db/prisma/schema.prisma ./prisma/schema.prisma
COPY --from=build --chown=app:app /repo/packages/db/prisma/migrations ./prisma/migrations
# The content snapshots for `node dist/import-content.js`, the one-off content import
# (packages/db/src/import). The same files the web app renders from without an API.
COPY --from=build --chown=app:app /repo/apps/web/static-content ./static-content
USER app
EXPOSE 4000
HEALTHCHECK --interval=20s --timeout=5s --retries=5 \
  CMD wget -qO- http://127.0.0.1:4000/health > /dev/null || exit 1
CMD ["node", "dist/main.js"]
