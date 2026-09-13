#!/usr/bin/env bash
# Post-deploy smoke test. A non-zero exit triggers automatic rollback.
# Add each public route here as it ships.
set -euo pipefail

BASE="${1:-https://calwebtech.com}"
ROUTES=(
  "/health/"     # web
  "/api/health"  # API through Traefik on the same origin, including the database
)

for route in "${ROUTES[@]}"; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$BASE$route")
  if [ "$code" != "200" ]; then
    echo "FAIL $route returned $code"
    exit 1
  fi
  echo "ok   $route"
done

echo "smoke passed"
