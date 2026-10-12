#!/usr/bin/env bash
# Local development: Django on :8000 (SQLite, LLM stub) and Vite on :5173. Ctrl-C stops both.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/backend"
export DJANGO_ENV=local LLM_MODE="${LLM_MODE:-stub}"
uv run python src/manage.py migrate --verbosity 0
uv run python src/manage.py index_guide
if uv run python src/manage.py help seed_demo >/dev/null 2>&1; then uv run python src/manage.py seed_demo; fi
uv run python src/manage.py runserver 127.0.0.1:8000 &
BACKEND=$!
trap 'kill $BACKEND 2>/dev/null' EXIT
cd "$ROOT/frontend" && npm run dev
