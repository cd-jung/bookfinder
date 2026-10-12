#!/usr/bin/env bash
# Create a new project from this template, with its own GitHub repo and Cloudflare resources.
#
#   scripts/new-project.sh <name> ["Display Name"] [--public]
#
# Does: GitHub repo from the template (private by default) -> D1 database, Vectorize index and
# Pages project -> project.config.json + apply-config -> CLOUDFLARE_API_TOKEN secret from the macOS
# Keychain -> first commit and push, which runs CI/CD and deploys.
# Prerequisites (one time, see README.md): gh auth login, wrangler login, Keychain item "cloudflare-api-token".
set -euo pipefail

NAME="${1:?usage: scripts/new-project.sh <name> [\"Display Name\"] [--public]}"
DISPLAY="${2:-$NAME}"
[[ "$DISPLAY" == --* ]] && DISPLAY="$NAME"
VISIBILITY="--private"
for arg in "$@"; do [[ "$arg" == "--public" ]] && VISIBILITY="--public"; done
[[ "$NAME" =~ ^[a-z][a-z0-9-]{1,40}$ ]] || { echo "name must be lowercase letters, digits and dashes"; exit 1; }

TEMPLATE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OWNER="$(jq -r '.githubOwner' "$TEMPLATE_DIR/project.config.json")"
TEMPLATE_REPO="${TEMPLATE_REPO:-$OWNER/$(basename "$TEMPLATE_DIR")}"
TARGET_PARENT="${PROJECTS_DIR:-$(dirname "$TEMPLATE_DIR")}"
TARGET="$TARGET_PARENT/$NAME"
export PATH="$HOME/.local/bin:$PATH"

step() { printf '\n==> %s\n' "$*"; }

step "Checking tools and sign-ins"
for tool in gh uv node npm jq; do command -v "$tool" >/dev/null || { echo "missing: $tool"; exit 1; }; done
gh auth status >/dev/null 2>&1 || { echo "run: gh auth login"; exit 1; }
security find-generic-password -s cloudflare-api-token >/dev/null 2>&1 || {
  echo 'Keychain item "cloudflare-api-token" not found. See README.md "Cloudflare API token".'; exit 1; }
[[ -e "$TARGET" ]] && { echo "$TARGET already exists"; exit 1; }

step "Creating GitHub repo $OWNER/$NAME from $TEMPLATE_REPO ($VISIBILITY)"
cd "$TARGET_PARENT"
gh repo create "$OWNER/$NAME" --template "$TEMPLATE_REPO" "$VISIBILITY" --clone
cd "$TARGET"
# The template's first commit may not be on disk yet right after creation.
for _ in 1 2 3 4 5; do [[ -f project.config.json ]] && break; sleep 3; git pull -q origin main || true; done

step "Installing dependencies"
(cd backend && uv sync -q && npm ci --silent)
(cd frontend && npm ci --silent)
(cd e2e && npm ci --silent)
WRANGLER="npx --prefix backend wrangler"

step "Creating Cloudflare resources"
$WRANGLER d1 create "$NAME-db" >/dev/null
D1_ID="$($WRANGLER d1 info "$NAME-db" --json | jq -r '.uuid')"
DIMS="$(jq -r '.ai.embeddingDimensions' project.config.json)"
$WRANGLER vectorize create "$NAME-guide" --dimensions="$DIMS" --metric=cosine >/dev/null
$WRANGLER pages project create "$NAME" --production-branch main >/dev/null
echo "D1 $NAME-db ($D1_ID), Vectorize $NAME-guide, Pages $NAME"

step "Writing project.config.json"
jq --arg n "$NAME" --arg d "$DISPLAY" --arg id "$D1_ID" '
  .name = $n | .displayName = $d |
  .cloudflare.workerName = ($n + "-api") | .cloudflare.pagesProject = $n |
  .cloudflare.d1Name = ($n + "-db") | .cloudflare.d1Id = $id | .cloudflare.vectorizeIndex = ($n + "-guide")
' project.config.json > project.config.tmp && mv project.config.tmp project.config.json
node scripts/apply-config.mjs

step "Setting the CLOUDFLARE_API_TOKEN repository secret from the Keychain"
security find-generic-password -s cloudflare-api-token -w | gh secret set CLOUDFLARE_API_TOKEN --repo "$OWNER/$NAME"

step "First commit and push (CI/CD deploys it)"
git add -A
git commit -qm "Initialize $NAME from template"
git push -q origin main
SUBDOMAIN="$(jq -r '.cloudflare.workersSubdomain' project.config.json)"
cat <<DONE

Done. Project: $TARGET
  GitHub:   https://github.com/$OWNER/$NAME   (watch: gh run watch --repo $OWNER/$NAME)
  App:      https://$NAME.pages.dev
  API:      https://$NAME-api.$SUBDOMAIN.workers.dev/api/health
  Coverage: https://$NAME.pages.dev/coverage/
DONE
