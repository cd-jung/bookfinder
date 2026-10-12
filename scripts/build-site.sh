#!/usr/bin/env bash
# Build what the frontend Worker serves (Workers Static Assets): the React app plus the coverage report
# (/reports/coverage.html, shown inside the app at /coverage) and the UX flow viewer (/ux-flows/).
# Requires unit test outputs in coverage/ (npm run test:unit) for the unit panel.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
node "$ROOT/scripts/unit-summary.mjs"
(cd "$ROOT/frontend" && npm run build)
mkdir -p "$ROOT/frontend/dist/reports" "$ROOT/frontend/dist/ux-flows"
(cd "$ROOT/ux-flows" && python3 build.py >/dev/null)
COVERAGE_REPORT_OUT="$ROOT/frontend/dist/reports/coverage.html" node "$ROOT/e2e/scripts/report-html.js"
cp "$ROOT"/ux-flows/{index.html,scenarios.js,mermaid.min.js} "$ROOT"/ux-flows/*.md "$ROOT/frontend/dist/ux-flows/"
# Security headers for Workers Static Assets (_headers). The app may only talk to its own API.
API_ORIGIN="${VITE_API_BASE:-}"
cat > "$ROOT/frontend/dist/_headers" <<HEADERS
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
  Strict-Transport-Security: max-age=31536000
  X-Frame-Options: SAMEORIGIN
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' ${API_ORIGIN}; frame-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'

# Generated reports inline their scripts (Mermaid, report code): allow inline scripts only there.
/reports/*
  ! Content-Security-Policy
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'self'; object-src 'none'
/ux-flows/*
  ! Content-Security-Policy
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'self'; object-src 'none'
HEADERS
echo "site built in frontend/dist"
