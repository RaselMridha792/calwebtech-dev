#!/usr/bin/env bash
# Post-deploy smoke test. A non-zero exit triggers automatic rollback.
set -euo pipefail

BASE="${1:-https://calwebtech.com}"
ROUTES=("/" "/services/" "/work/" "/contact/" "/api/health")

for route in "${ROUTES[@]}"; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$BASE$route")
  if [ "$code" != "200" ]; then
    echo "FAIL $route returned $code"
    exit 1
  fi
  echo "ok   $route"
done

echo "smoke passed"
