#!/usr/bin/env bash
# Nightly encrypted off-site backup of one stack (docs/01 "Backup and recovery", Task 6.4).
#
# The long-running process of the `backup` service in infra/docker-compose.yml, from the
# image in infra/backup/Dockerfile. Every night at BACKUP_TIME it streams a pg_dump of the
# stack's database into a restic repository off the server, snapshots the media volume,
# applies the retention policy and, on Sundays, verifies the repository. Nothing is written
# to the local disk: the dump goes from pg_dump straight into restic, which encrypts before
# it uploads.
#
#   backup-entrypoint.sh            the schedule (the service's entrypoint)
#   backup-entrypoint.sh once       one backup now, exit 0 or 1
#   backup-entrypoint.sh healthy    the Compose healthcheck: exit 1 once the last complete
#                                   backup is older than 26 hours
#   backup-entrypoint.sh restic ... any restic command with the service's environment
#
# From the server, with
#   COMPOSE=(docker compose -p calwebtech-staging --env-file /srv/calwebtech/env/staging.env
#            -f infra/docker-compose.yml --profile ops)
#   "${COMPOSE[@]}" up -d backup                      start the schedule
#   "${COMPOSE[@]}" run --rm backup once              one backup now
#   "${COMPOSE[@]}" run --rm backup restic snapshots  list what is off-site
#   "${COMPOSE[@]}" run --rm -e RESTORE_CONFIRM=yes backup /scripts/restore.sh latest
#
# Environment (infra/env/<stack>.env.example, "backups"):
#   DATABASE_URL            the stack's database, host `db` on the internal network
#   RESTIC_REPOSITORY       where the snapshots go: an account separate from the VPS
#   RESTIC_PASSWORD         encrypts the repository; losing it loses every backup
#   AWS_ACCESS_KEY_ID       provider credentials for an s3: repository, read by restic
#   AWS_SECRET_ACCESS_KEY
#   BACKUP_TIME             HH:MM on the container clock, default 03:00
#   BACKUP_KEEP_DAILY, BACKUP_KEEP_WEEKLY, BACKUP_KEEP_MONTHLY   retention, default 7/4/6
#   BACKUP_HEALTHCHECK_URL  optional push URL (Uptime Kuma) fetched after every success
#   RUN_NOW                 true runs one backup on start, then keeps the schedule
#
# A failed night is logged and the loop carries on to the next one. It still shows: the
# health marker is only written after a complete run, so the container turns unhealthy in
# `docker ps` once a backup is 26 hours overdue, and a push monitor stops hearing from it.
set -euo pipefail

MARKER=/tmp/last-backup-ok
MAX_AGE=$(( 26 * 3600 ))   # the 24-hour RPO plus slack
DUMP_NAME=calwebtech.dump
MODE="${1:-}"

log() { printf '%s backup: %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$*"; }

# The healthcheck reads the marker and nothing else: it must not depend on an environment
# that a misconfigured container has already exited over.
if [ "$MODE" = healthy ]; then
  [ -f "$MARKER" ] || exit 1
  [ $(( $(date +%s) - $(cat "$MARKER") )) -lt "$MAX_AGE" ] || exit 1
  exit 0
fi

# The ops profile is opt-in; a half-configured backup must fail loud, never sit quietly.
for name in DATABASE_URL RESTIC_REPOSITORY RESTIC_PASSWORD; do
  if [ -z "${!name:-}" ]; then
    echo "backup: $name is empty; set it in the stack's env file (see infra/env/staging.env.example, backups)" >&2
    exit 1
  fi
done
BACKUP_TIME="${BACKUP_TIME:-03:00}"
if ! [[ "$BACKUP_TIME" =~ ^([01][0-9]|2[0-3]):[0-5][0-9]$ ]]; then
  echo "backup: BACKUP_TIME must be HH:MM, got '$BACKUP_TIME'" >&2
  exit 1
fi
KEEP_DAILY="${BACKUP_KEEP_DAILY:-7}"
KEEP_WEEKLY="${BACKUP_KEEP_WEEKLY:-4}"
KEEP_MONTHLY="${BACKUP_KEEP_MONTHLY:-6}"
# A fixed host name for the snapshots: restic groups them by host when applying retention,
# and the container's own name changes every time it is recreated.
HOST="calwebtech-${STACK:-local}"
# Fail fast when db is unreachable instead of hanging the night's run.
export PGCONNECT_TIMEOUT=30

case "$MODE" in
  ""|once) ;;
  restic) shift; exec restic "$@" ;;
  *) echo "usage: backup-entrypoint.sh [once|healthy|restic <args>]" >&2; exit 2 ;;
esac

# An empty repository is created on first contact. Anything else that stops restic
# reading the config (wrong password, provider down) is fatal here; the container
# restarts and tries again.
if restic cat config >/dev/null 2>&1; then
  log "repository $RESTIC_REPOSITORY is ready"
else
  log "repository $RESTIC_REPOSITORY is not initialised, creating it"
  restic init
fi

# The snapshot id from `restic backup --json` output, or nothing.
snapshot_id() { grep -o '"snapshot_id":"[0-9a-f]*"' | tail -n 1 | cut -d'"' -f4 || true; }

backup_database() {
  local out id
  log "database: pg_dump | restic backup ($DUMP_NAME)"
  # Uncompressed on purpose: restic deduplicates and compresses the stream itself, and an
  # uncompressed dump changes far less between nights than a gzipped one would. pg_dump's
  # stderr stays on the container log, never in the pipe.
  if out="$(pg_dump --dbname="$DATABASE_URL" --format=custom --compress=0 \
        | restic backup --stdin --stdin-filename "$DUMP_NAME" --host "$HOST" --tag db --json 2>&1)"; then
    id="$(printf '%s\n' "$out" | snapshot_id)"
    log "database: snapshot ${id:0:8} saved"
    return 0
  fi
  # pg_dump can die after restic has started reading, and restic then saves whatever
  # arrived. Drop that snapshot so `latest` never names a partial dump.
  id="$(printf '%s\n' "$out" | snapshot_id)"
  if [ -z "$id" ]; then
    log "database: FAILED: $(printf '%s\n' "$out" | tail -n 1)"
  elif restic forget --quiet "$id"; then
    log "database: FAILED; discarded the partial snapshot ${id:0:8}"
  else
    log "database: FAILED; could not discard the partial snapshot $id, forget it by hand"
  fi
  return 1
}

backup_media() {
  local out
  log "media: restic backup /media"
  if out="$(restic backup --host "$HOST" --tag media --json /media 2>&1)"; then
    log "media: snapshot $(printf '%s\n' "$out" | snapshot_id | cut -c1-8) saved"
    return 0
  fi
  log "media: FAILED: $(printf '%s\n' "$out" | tail -n 1)"
  return 1
}

apply_retention() {
  log "retention: keep $KEEP_DAILY daily, $KEEP_WEEKLY weekly, $KEEP_MONTHLY monthly, then prune"
  if restic forget --quiet --host "$HOST" --keep-daily "$KEEP_DAILY" --keep-weekly "$KEEP_WEEKLY" \
       --keep-monthly "$KEEP_MONTHLY" --prune; then
    log "retention: applied"
    return 0
  fi
  log "retention: FAILED (tonight's snapshots are intact; old ones were not removed)"
  return 1
}

check_repository() {
  log "check: restic check (Sundays)"
  if restic check --quiet; then
    log "check: repository is consistent"
    return 0
  fi
  log "check: FAILED; the repository needs attention before a restore from it is trusted"
  return 1
}

run_backup() {
  local ok=true started=$SECONDS
  backup_database || ok=false
  backup_media || ok=false
  apply_retention || ok=false
  if [ "$(date +%u)" = 7 ]; then
    check_repository || ok=false
  fi
  if [ "$ok" != true ]; then
    log "backup FAILED after $(( SECONDS - started ))s; see the lines above"
    return 1
  fi
  date +%s > "$MARKER"
  if [ -n "${BACKUP_HEALTHCHECK_URL:-}" ]; then
    curl -fsS --max-time 10 --retry 2 -o /dev/null "$BACKUP_HEALTHCHECK_URL" ||
      log "healthcheck push to BACKUP_HEALTHCHECK_URL failed (the backup itself succeeded)"
  fi
  log "backup complete in $(( SECONDS - started ))s"
  return 0
}

if [ "$MODE" = once ]; then
  if run_backup; then exit 0; else exit 1; fi
fi

# Seconds from now to the next HH:MM on the container clock. Clock arithmetic rather than
# `date -d`, which busybox only half supports. A DST change shifts one night by an hour,
# which a nightly backup can wear.
seconds_until() {
  local h m s now target
  read -r h m s <<< "$(date '+%H %M %S')"
  now=$(( 10#$h * 3600 + 10#$m * 60 + 10#$s ))
  target=$(( 10#${1%%:*} * 3600 + 10#${1##*:} * 60 ))
  [ "$target" -gt "$now" ] || target=$(( target + 86400 ))
  echo $(( target - now ))
}

# `sleep` runs in the background and is waited on, so a stop is handled at once rather
# than after the night's wait. The base image stops with SIGINT, Compose with SIGTERM.
trap 'log "stopping"; exit 0' TERM INT

if [ "${RUN_NOW:-}" = true ]; then
  log "RUN_NOW: backing up now, then keeping the $BACKUP_TIME schedule"
  run_backup || true
fi
while true; do
  wait_s="$(seconds_until "$BACKUP_TIME")"
  log "next backup at $BACKUP_TIME, in ${wait_s}s"
  sleep "$wait_s" & wait "$!" || true
  run_backup || true
done
