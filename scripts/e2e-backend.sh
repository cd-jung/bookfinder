#!/usr/bin/env bash
# Start the local backend for E2E: fresh SQLite DB, migrations, User Guide index, deterministic LLM stub.
set -euo pipefail
cd "$(dirname "$0")/../backend"
export DJANGO_ENV=local LLM_MODE=stub LOCAL_DB_PATH="${LOCAL_DB_PATH:-$PWD/e2e.sqlite3}"
rm -f "$LOCAL_DB_PATH"
uv run python src/manage.py migrate --verbosity 0
uv run python src/manage.py index_guide
# Optional project seed data (define core/management/commands/seed_demo.py in the project).
if uv run python src/manage.py help seed_demo >/dev/null 2>&1; then uv run python src/manage.py seed_demo; fi
exec uv run python src/manage.py runserver 127.0.0.1:8000 --noreload
