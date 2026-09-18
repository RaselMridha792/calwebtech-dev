#!/usr/bin/env bash
# Restores a database dump from the restic repository into this stack's `db`. Destructive:
# pg_restore --clean drops every object in the dump before recreating it.
#
#   restore.sh [snapshot-id|latest]      does nothing unless RESTORE_CONFIRM=yes
#
# Runs inside the backup image (infra/backup/Dockerfile) with the service's environment,
# so it reaches the repository and the database exactly as the nightly backup does. From
# the server, into staging:
#
#   docker compose -p calwebtech-staging --env-file /srv/calwebtech/env/staging.env \
#     -f infra/docker-compose.yml --profile ops \
#     run --rm -e RESTORE_CONFIRM=yes backup /scripts/restore.sh latest
#
# Without RESTORE_CONFIRM it prints the snapshot it would restore and stops, which is the
# safe way to look first.
#
# The drill (docs/06 Task 6.4) is done into staging first, in the client's presence, and
# never straight into production. To rehearse with production's data, point that one run
# at production's repository: add -e RESTIC_REPOSITORY=... -e RESTIC_PASSWORD=... (and the
# provider keys, if they differ) to the command above. The staging env file's DATABASE_URL
# still names staging's db, so that is where the data lands. Production itself is the same
# command with -p calwebtech-production and production's env file, only after the staging
# drill has passed.
#
# Before: stop the app so nothing writes during the restore.
#   ... stop web api worker
# After: bring the schema forward if the dump predates the running code, then start it.
#   ... run --rm api node dist/migrate.js
#   ... up -d --wait web api worker
# Objects that exist only in the current database (a table from a later migration) are
# not in the dump and survive --clean; migrate.js is what reconciles that.
set -euo pipefail

TARGET="${1:-latest}"
DUMP_NAME=calwebtech.dump

log() { printf '%s restore: %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$*"; }

for name in DATABASE_URL RESTIC_REPOSITORY RESTIC_PASSWORD; do
  if [ -z "${!name:-}" ]; then
    echo "restore: $name is empty; set it in the stack's env file" >&2
    exit 1
  fi
done
export PGCONNECT_TIMEOUT=30

# Resolve the target to one snapshot id now, so what is printed is what gets restored
# even if a backup lands in between.
if [ "$TARGET" = latest ]; then
  found="$(restic snapshots --json --tag db --latest 1)"
else
  found="$(restic snapshots --json --tag db "$TARGET")"
fi
id="$(printf '%s\n' "$found" | grep -o '"short_id":"[0-9a-f]*"' | head -n 1 | cut -d'"' -f4 || true)"
if [ -z "$id" ]; then
  echo "restore: no database snapshot matches '$TARGET' in $RESTIC_REPOSITORY (tag db)" >&2
  exit 1
fi

# The database, with its password masked, so the log shows where the data is going.
log "target database: $(printf '%s' "$DATABASE_URL" | sed -E 's#//([^:/@]+):[^@]*@#//\1:***@#')"
log "snapshot to restore ($TARGET):"
restic snapshots "$id"

if [ "${RESTORE_CONFIRM:-}" != yes ]; then
  echo "restore: refusing to continue. This replaces the current database with the snapshot above." >&2
  echo "restore: re-run with RESTORE_CONFIRM=yes (docker compose ... run --rm -e RESTORE_CONFIRM=yes backup /scripts/restore.sh $TARGET)" >&2
  exit 1
fi

log "pg_restore --clean --if-exists --no-owner from snapshot $id"
# Streamed: restic decrypts the dump straight into pg_restore, nothing touches the disk.
# --single-transaction rolls the whole restore back on any error, so a broken dump or a
# lost connection leaves the database as it was.
restic dump "$id" "$DUMP_NAME" \
  | pg_restore --dbname="$DATABASE_URL" --clean --if-exists --no-owner --no-privileges \
      --single-transaction --exit-on-error
tables="$(psql "$DATABASE_URL" -Atc "select count(*) from pg_tables where schemaname = 'public'")"
log "done: $tables tables in public. Run migrate.js, then start web, api and worker."
