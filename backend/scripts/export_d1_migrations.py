"""Export Django migrations as SQL files that `wrangler d1 migrations apply` understands.

D1 cannot run `manage.py migrate` (no shell on Workers), so every Django migration is turned into
d1_migrations/NNNN_<app>_<migration>.sql with `sqlmigrate` (SQLite dialect). Existing files keep
their number; new migrations get the next one. `--check` fails when a file is missing or stale,
which CI and the consistency check use.

Usage (from backend/): uv run python scripts/export_d1_migrations.py [--check]
"""

import io
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
os.environ["DJANGO_ENV"] = "test"

import django  # noqa: E402

django.setup()

from django.core.management import call_command  # noqa: E402
from django.db import connection  # noqa: E402
from django.db.migrations.loader import MigrationLoader  # noqa: E402

OUT = ROOT / "d1_migrations"
LOCAL_APPS = {"core", "logs", "rag"} | {p.parent.name for p in (ROOT / "src").glob("*/migrations/__init__.py")}


def ordered_migrations():
    loader = MigrationLoader(connection)
    plan = []
    for leaf in sorted(loader.graph.leaf_nodes()):
        for key in loader.graph.forwards_plan(leaf):
            if key not in plan and key[0] in LOCAL_APPS:
                plan.append(key)
    return plan


def sql_for(app, name):
    buffer = io.StringIO()
    call_command("sqlmigrate", app, name, stdout=buffer)
    sql = buffer.getvalue()
    # D1 manages its own transactions; BEGIN/COMMIT from sqlmigrate are not allowed.
    sql = re.sub(r"^\s*(BEGIN|COMMIT);\s*$", "", sql, flags=re.M)
    return (
        f"-- Generated from Django migration {app}.{name}. Do not edit; edit the model and re-export.\n"
        + sql.strip()
        + "\n"
    )


def main(check):
    OUT.mkdir(exist_ok=True)
    existing = {re.sub(r"^\d{4}_", "", p.stem): p for p in OUT.glob("*.sql")}
    next_number = max([int(p.name[:4]) for p in existing.values()] or [0]) + 1
    problems = []
    for app, name in ordered_migrations():
        key = f"{app}_{name}"
        sql = sql_for(app, name)
        path = existing.get(key)
        if path is None:
            path = OUT / f"{next_number:04d}_{key}.sql"
            next_number += 1
            if check:
                problems.append(f"missing D1 migration for {app}.{name}")
                continue
        elif path.read_text() != sql:
            if check:
                problems.append(f"stale D1 migration {path.name}")
                continue
        else:
            continue
        path.write_text(sql)
        print(f"wrote {path.relative_to(ROOT)}")
    if problems:
        print("\n".join(problems))
        print("Run: uv run python scripts/export_d1_migrations.py")
        sys.exit(1)


if __name__ == "__main__":
    main("--check" in sys.argv)
