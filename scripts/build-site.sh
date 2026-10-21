#!/usr/bin/env bash
# Build both sites from one codebase:
#   frontend/dist        public site (search, User Guide, Help,          -> frontend Worker (static assets)
#                        coverage report, UX flow viewer)
#   frontend/dist-admin  admin site (logs, monitoring)                    -> admin Worker (assets + /api proxy),
#                                                                            protected by Cloudflare Access
# URLs come from project.config.json unless PUBLIC_URL / ADMIN_URL / API_URL are set.
# Requires unit test outputs in coverage/ (npm run test:unit) for the report's unit panel.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CFG="$ROOT/project.config.json"
SUB=$(jq -r '.cloudflare.workersSubdomain' "$CFG")
PUBLIC_URL="${PUBLIC_URL:-https://$(jq -r '.cloudflare.frontendWorker' "$CFG").$SUB.workers.dev}"
ADMIN_URL="${ADMIN_URL:-https://$(jq -r '.cloudflare.adminWorker' "$CFG").$SUB.workers.dev}"
API_URL="${API_URL:-${VITE_API_BASE:-https://$(jq -r '.cloudflare.workerName' "$CFG").$SUB.workers.dev}}"

headers() { # $1 = dist dir, $2 = connect-src origins
  cat > "$1/_headers" <<HEADERS
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
  Strict-Transport-Security: max-age=31536000
  X-Frame-Options: SAMEORIGIN
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' $2; frame-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'

# Generated reports inline their scripts (Mermaid, report code): allow inline scripts only there.
/reports/*
  ! Content-Security-Policy
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'self'; object-src 'none'
/ux-flows/*
  ! Content-Security-Policy
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'self'; object-src 'none'
HEADERS
}

node "$ROOT/scripts/unit-summary.mjs"
cd "$ROOT/frontend"
npx tsc -b
VITE_SITE=public VITE_API_BASE="$API_URL" VITE_ADMIN_URL="$ADMIN_URL" VITE_PUBLIC_URL="$PUBLIC_URL" npx vite build --outDir dist --emptyOutDir
mkdir -p dist/reports dist/ux-flows
(cd "$ROOT/ux-flows" && python3 build.py >/dev/null)
COVERAGE_REPORT_OUT="$ROOT/frontend/dist/reports/coverage.html" node "$ROOT/e2e/scripts/report-html.js"
cp "$ROOT"/ux-flows/{index.html,scenarios.js,mermaid.min.js} "$ROOT"/ux-flows/*.md dist/ux-flows/
headers dist "$API_URL"
VITE_SITE=admin VITE_API_BASE="" VITE_ADMIN_URL="$ADMIN_URL" VITE_PUBLIC_URL="$PUBLIC_URL" npx vite build --outDir dist-admin --emptyOutDir
headers dist-admin ""
echo "sites built: frontend/dist ($PUBLIC_URL) and frontend/dist-admin ($ADMIN_URL)"
