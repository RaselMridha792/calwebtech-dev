#!/usr/bin/env bash
# Deploys one stack on the server: the shared edge proxy, then the stack itself.
#
#   bash infra/scripts/deploy.sh <staging|production> <image tag>
#
# The release workflow copies infra/ for the commit to $DEPLOY_ROOT/infra and runs this
# over SSH. It needs, on the server and never in the repo:
#   $DEPLOY_ROOT/env/<stack>.env           from infra/env/<stack>.env.example, mode 600
#   $DEPLOY_ROOT/secrets/staging.htpasswd  staging only: htpasswd -nbB <user> <password>
#
# Order: proxy, pull, database, migrate, optional seed, roll out, smoke test, and only then
# record the new tag in the env file. Until the smoke test passes the new tag lives only in
# this shell's environment, which Compose prefers over --env-file, so a deploy that fails
# or is cut off (a cancelled job, a dropped SSH session) leaves the file on the last tag
# that went live. A failing step brings that tag back; on a first deploy, with no earlier
# tag, it stops the release that failed.
#
# DEPLOY_SKIP_PULL=true is for a local rehearsal with locally built images only.
set -euo pipefail

STACK="${1:?usage: deploy.sh <staging|production> <image tag>}"
TAG="${2:?usage: deploy.sh <staging|production> <image tag>}"
DEPLOY_ROOT="${DEPLOY_ROOT:-/srv/calwebtech}"
INFRA="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$DEPLOY_ROOT/env/$STACK.env"

[ -f "$ENV_FILE" ] || { echo "deploy: $ENV_FILE is missing" >&2; exit 1; }

env_value() {
  grep -E "^$1=" "$ENV_FILE" | tail -n 1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/' || true
}
set_tag() {
  if grep -qE '^TAG=' "$ENV_FILE"; then
    sed -i "s/^TAG=.*/TAG=$1/" "$ENV_FILE"
  else
    echo "TAG=$1" >> "$ENV_FILE"
  fi
}

if [ "$(env_value STACK)" != "$STACK" ]; then
  echo "deploy: STACK in $ENV_FILE is not $STACK" >&2
  exit 1
fi

PROXY=(docker compose -p calwebtech-proxy --env-file "$ENV_FILE" -f "$INFRA/proxy/docker-compose.yml")
APP=(docker compose -p "calwebtech-$STACK" --env-file "$ENV_FILE" -f "$INFRA/docker-compose.yml")
PREVIOUS="$(env_value TAG)"

echo "deploy: edge proxy"
"${PROXY[@]}" up -d --wait

rollback() {
  trap - ERR
  if [ -n "$PREVIOUS" ]; then
    echo "deploy: $1, rolling back to $PREVIOUS" >&2
    TAG="$PREVIOUS" "${APP[@]}" up -d --wait web api worker ||
      echo "deploy: the previous tag did not come back healthy either" >&2
  else
    # A first deploy has nothing to roll back to. Stop the release that failed rather than
    # leave it serving; the database and Redis keep running.
    echo "deploy: $1 on a first deploy, stopping the failed release" >&2
    "${APP[@]}" rm --stop --force web api worker || echo "deploy: could not stop the failed release" >&2
  fi
  exit 1
}

echo "deploy: $STACK at $TAG (previous: ${PREVIOUS:-none})"
# Compose reads TAG from this environment before the env file.
export TAG
# From here on, any failing step (pull, database, migration, seed, rollout) triggers the
# rollback.
trap 'rollback "a deploy step failed"' ERR

if [ "${DEPLOY_SKIP_PULL:-}" != "true" ]; then
  "${APP[@]}" pull web api worker
fi
"${APP[@]}" up -d --wait db redis
"${APP[@]}" run --rm api node dist/migrate.js
if [ "$(env_value SEED_ON_DEPLOY)" = "true" ]; then
  echo "deploy: seeding placeholder content"
  "${APP[@]}" run --rm api node dist/seed.js
fi
"${APP[@]}" up -d --wait web api worker

export SMOKE_BASIC_AUTH EXPECT_NOINDEX EXPECT_HSTS SMOKE_INSECURE SMOKE_RESOLVE
SMOKE_BASIC_AUTH="$(env_value SMOKE_BASIC_AUTH)"
EXPECT_NOINDEX="$(env_value EXPECT_NOINDEX)"
EXPECT_HSTS="$(env_value EXPECT_HSTS)"
SMOKE_INSECURE="${SMOKE_INSECURE:-}"
SMOKE_RESOLVE="${SMOKE_RESOLVE:-}"
if ! bash "$INFRA/scripts/smoke.sh" "https://$(env_value SITE_HOST)"; then
  rollback "smoke test failed"
fi
trap - ERR

# Recorded only now, so the env file never names a release that did not pass.
set_tag "$TAG"
echo "deploy: $STACK is live at $TAG"
