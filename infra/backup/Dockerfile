# syntax=docker/dockerfile:1.7
# Backup sidecar for the `ops` profile: pg_dump at the same PostgreSQL major as the `db`
# service, restic for encrypted off-site snapshots, and the two scripts that drive them.
# Built in GitHub Actions and pulled by the VPS. Never build this on the VPS.
# Build context is the repository root: docker build -f infra/backup/Dockerfile .

FROM postgres:17-alpine
RUN apk add --no-cache restic bash curl
# --chmod because the execute bit does not survive every checkout (Windows).
COPY --chmod=755 infra/scripts/backup-entrypoint.sh infra/scripts/restore.sh /scripts/
# restic's index cache sits next to the health marker in /tmp, the one place a non-root
# user can write. GOGC=20 trades CPU for a smaller heap under the service's 256m limit.
ENV RESTIC_CACHE_DIR=/tmp/restic-cache \
    GOGC=20
# Same uid as the api image, so whatever the api writes to the media volume is readable.
RUN addgroup -S -g 1001 app && adduser -S -u 1001 -G app app
USER app
ENTRYPOINT ["/scripts/backup-entrypoint.sh"]
# The base image's CMD ["postgres"] would otherwise arrive as the entrypoint's first argument.
CMD []
