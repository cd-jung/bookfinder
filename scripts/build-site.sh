#!/usr/bin/env bash
# Build what Pages serves: the React app plus the coverage report (/coverage/) and the UX flow viewer (/ux-flows/).
# Requires unit test outputs in coverage/ (npm run test:unit) for the unit panel.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
node "$ROOT/scripts/unit-summary.mjs"
(cd "$ROOT/frontend" && npm run build)
mkdir -p "$ROOT/frontend/dist/coverage" "$ROOT/frontend/dist/ux-flows"
(cd "$ROOT/ux-flows" && python3 build.py >/dev/null)
COVERAGE_REPORT_OUT="$ROOT/frontend/dist/coverage/index.html" node "$ROOT/e2e/scripts/report-html.js"
cp "$ROOT"/ux-flows/{index.html,scenarios.js,mermaid.min.js} "$ROOT"/ux-flows/*.md "$ROOT/frontend/dist/ux-flows/"
echo "site built in frontend/dist"
