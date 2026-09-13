# syntax=docker/dockerfile:1.7
# BullMQ worker. Built in GitHub Actions and pulled by the VPS. Never build this on the VPS.
# Build context is the repository root: docker build -f apps/worker/Dockerfile .

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
    pnpm install --offline --frozen-lockfile --filter "@calwebtech/worker..."
RUN pnpm --filter "@calwebtech/worker..." run build
# A self-contained copy of the worker with production dependencies only, including the
# compiled @calwebtech/db, @calwebtech/emails and @calwebtech/shared packages.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --filter @calwebtech/worker deploy --prod --legacy /out

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S -g 1001 app && adduser -S -u 1001 -G app app
COPY --from=build --chown=app:app /out ./
USER app
# Closes active jobs on SIGTERM before exiting; give it time on rolling restarts.
STOPSIGNAL SIGTERM
CMD ["node", "dist/main.js"]
