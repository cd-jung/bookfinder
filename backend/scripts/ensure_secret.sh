#!/usr/bin/env bash
# CD step: make sure the API Worker has a DJANGO_SECRET_KEY secret (random, never printed).
set -euo pipefail
cd "$(dirname "$0")/.."
if npx wrangler secret list --format json 2>/dev/null | jq -e '.[] | select(.name == "DJANGO_SECRET_KEY")' >/dev/null; then
  echo "DJANGO_SECRET_KEY already set"
  exit 0
fi
python3 -c "import secrets; print(secrets.token_urlsafe(48), end='')" | npx wrangler secret put DJANGO_SECRET_KEY >/dev/null
echo "DJANGO_SECRET_KEY created"
