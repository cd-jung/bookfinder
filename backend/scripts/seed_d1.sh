#!/usr/bin/env bash
# CD step: load the project's seed data into D1 once (only while the target table is empty).
# A project opts in by providing scripts/export_seed_sql.py and setting SEED_TABLE.
set -euo pipefail
cd "$(dirname "$0")/.."
SEED_TABLE="${SEED_TABLE:-books_book}"
[[ -f scripts/export_seed_sql.py ]] || { echo "no seed script; skipping"; exit 0; }
COUNT=$(npx wrangler d1 execute DB --remote --json --command "SELECT COUNT(*) AS c FROM $SEED_TABLE" | jq '.[0].results[0].c')
if [[ "$COUNT" != "0" ]]; then echo "$SEED_TABLE already has $COUNT rows; skipping seed"; exit 0; fi
uv run python scripts/export_seed_sql.py > /tmp/seed.sql
echo "seeding $(grep -c '^INSERT' /tmp/seed.sql) insert statements into $SEED_TABLE"
npx wrangler d1 execute DB --remote --file /tmp/seed.sql -y > /dev/null
echo "seed done"
