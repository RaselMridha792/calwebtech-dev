#!/usr/bin/env bash
# Post-deploy smoke test. A non-zero exit makes infra/scripts/deploy.sh roll back.
#
#   bash infra/scripts/smoke.sh https://staging.calwebtech.com
#
# Environment:
#   SMOKE_BASIC_AUTH  user:password for a host behind basic auth (staging). The test also
#                     checks that a request without credentials is refused.
#   EXPECT_NOINDEX    true on a host that must never be indexed: every route must answer
#                     with an X-Robots-Tag containing noindex.
#   SMOKE_INSECURE    true to accept a self-signed certificate. Local rehearsal only.
#   SMOKE_RESOLVE     host:port:address for curl --resolve. Local rehearsal only.
#
# Add each public route here as it ships.
set -euo pipefail

BASE="${1:-https://calwebtech.com}"
ROUTES=(
  "/health/"                  # web
  "/api/health"               # API through Traefik on the same origin, including the database
  "/"                         # homepage, rendered per request from the API
  "/lp/b2b-website-design/"   # campaign landing page, rendered from the API
)

CURL=(curl -s --max-time 20)
[ "${SMOKE_INSECURE:-}" = "true" ] && CURL+=(-k)
[ -n "${SMOKE_RESOLVE:-}" ] && CURL+=(--resolve "$SMOKE_RESOLVE")
AUTH=()
[ -n "${SMOKE_BASIC_AUTH:-}" ] && AUTH=(-u "$SMOKE_BASIC_AUTH")

fail() {
  echo "FAIL $1"
  exit 1
}

if [ -n "${SMOKE_BASIC_AUTH:-}" ]; then
  code=$("${CURL[@]}" -o /dev/null -w '%{http_code}' "$BASE/health/")
  [ "$code" = "401" ] || fail "/health/ without credentials returned $code, expected 401"
  echo "ok   anonymous requests are refused"
fi

for route in "${ROUTES[@]}"; do
  response=$("${CURL[@]}" "${AUTH[@]}" -o /dev/null -D - -w '\n%{http_code}' "$BASE$route" || true)
  code=$(printf '%s' "$response" | tail -n 1)
  [ "$code" = "200" ] || fail "$route returned ${code:-no response}"
  if [ "${EXPECT_NOINDEX:-}" = "true" ]; then
    printf '%s' "$response" | grep -qiE '^x-robots-tag:.*noindex' || fail "$route has no X-Robots-Tag noindex"
  fi
  echo "ok   $route"
done

echo "smoke passed"
