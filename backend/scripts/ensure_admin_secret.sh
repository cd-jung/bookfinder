#!/usr/bin/env bash
# CD step: give the API Worker and the admin Worker the same random ADMIN_PROXY_SECRET (never printed).
# Runs after both Workers are deployed. Rotates both together when either side is missing it.
set -euo pipefail
cd "$(dirname "$0")/.."
ADMIN_CONFIG=../frontend/wrangler.admin.jsonc
has() { npx wrangler secret list "$@" --format json 2>/dev/null | jq -e '.[] | select(.name == "ADMIN_PROXY_SECRET")' >/dev/null; }
if has && has --config "$ADMIN_CONFIG"; then echo "ADMIN_PROXY_SECRET already set on both Workers"; exit 0; fi
SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(48), end='')")
printf '%s' "$SECRET" | npx wrangler secret put ADMIN_PROXY_SECRET >/dev/null
printf '%s' "$SECRET" | npx wrangler secret put ADMIN_PROXY_SECRET --config "$ADMIN_CONFIG" >/dev/null
echo "ADMIN_PROXY_SECRET set on both Workers"
