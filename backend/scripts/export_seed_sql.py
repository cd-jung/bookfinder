"""Print the generated catalogue as SQL INSERTs for D1 (`wrangler d1 execute --file`).

Used by backend/scripts/seed_d1.sh in CD, only when the books table is empty: seeding 10,000 books
writes roughly 50k D1 rows (with index entries), half of the free plan's daily write allowance.
"""

import os
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
os.environ["DJANGO_ENV"] = "test"

import django  # noqa: E402

django.setup()

from books.models import Author, Book  # noqa: E402
from books.seed import generate  # noqa: E402


def literal(value):
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, int | float):
        return repr(value)
    if isinstance(value, date):
        return f"'{value.isoformat()}'"
    return "'" + str(value).replace("'", "''") + "'"


def inserts(table, rows, batch=200):
    columns = list(rows[0])
    for start in range(0, len(rows), batch):
        values = ",".join("(" + ",".join(literal(r[c]) for c in columns) + ")" for r in rows[start : start + batch])
        yield f'INSERT INTO "{table}" ({",".join(columns)}) VALUES {values};'


def main():
    books, authors = generate()
    for line in inserts(Book._meta.db_table, books):
        print(line)
    for line in inserts(Author._meta.db_table, authors):
        print(line)


if __name__ == "__main__":
    main()
