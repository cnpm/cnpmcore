#!/bin/bash
# Health check for cnpmcore Docker container
# Usage: bash .docker/health-check.sh <container-name>

set -euo pipefail

CONTAINER="${1:?Usage: health-check.sh <container-name>}"
URL="http://127.0.0.1:7001"
PATTERN="instance_start_time"
TIMEOUT=60
TMP="$(mktemp)"

echo "🔎 Health check $URL for container $CONTAINER, expect 200 & body contains: $PATTERN"
deadline=$((SECONDS + TIMEOUT))

last_status=""
while (( SECONDS < deadline )); do
  last_status="$(curl -sS -o "$TMP" -w '%{http_code}' "$URL" || true)"
  if [[ "$last_status" == "200" ]] && grep -q "$PATTERN" "$TMP"; then
    echo "✅ $CONTAINER health check passed"
    rm -f "$TMP"
    docker stop "$CONTAINER"
    exit 0
  fi
  sleep 2
done

echo "::error::❌ $CONTAINER health check failed: status=$last_status"
echo "---- Response body (last try) ----"
cat "$TMP" || true
echo "---- Container logs ----"
docker logs "$CONTAINER" --tail 100
rm -f "$TMP"
docker stop "$CONTAINER"
exit 1
