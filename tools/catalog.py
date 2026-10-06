#!/usr/bin/env python3
"""Build or dump the SmartGuide device catalog.

The catalog is versioned as a gzipped SQL seed (database/seed-devices.sql.gz)
next to the schema, and turned into a SQLite file at image build time.

    python3 tools/catalog.py build   # schema + seed -> catalog/smartguide.db
    python3 tools/catalog.py dump    # catalog/smartguide.db -> seed (after an import)
"""

from __future__ import annotations

import argparse
import gzip
import sqlite3
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SCHEMA_FILE = REPO_ROOT / "database" / "schema.sql"
SEED_FILE = REPO_ROOT / "database" / "seed-devices.sql.gz"
DEFAULT_DATABASE = REPO_ROOT / "catalog" / "smartguide.db"

# Parents before children, so the seed loads with foreign keys enabled.
TABLES = [
    "import_runs",
    "devices",
    "device_variants",
    "device_identifiers",
    "device_sources",
    "device_capabilities",
    "device_compatibility",
]


def build(database: Path, seed: Path) -> None:
    database.parent.mkdir(parents=True, exist_ok=True)
    tmp = database.with_suffix(".db.tmp")
    tmp.unlink(missing_ok=True)

    connection = sqlite3.connect(tmp)
    try:
        connection.executescript(SCHEMA_FILE.read_text(encoding="utf-8"))
        with gzip.open(seed, "rt", encoding="utf-8") as handle:
            connection.executescript(handle.read())
        connection.commit()
        connection.execute("VACUUM")
        counts = {table: connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0] for table in TABLES}
    finally:
        connection.close()

    tmp.replace(database)
    print(f"Katalog gebaut: {database} ({counts['devices']} Geräte)")


def dump(database: Path, seed: Path) -> None:
    if not database.is_file():
        raise SystemExit(f"Katalog nicht gefunden: {database}")

    connection = sqlite3.connect(database)
    connection.row_factory = None
    try:
        with gzip.open(seed, "wt", encoding="utf-8", compresslevel=9) as handle:
            handle.write("BEGIN;\n")
            for table in TABLES:
                columns = [row[1] for row in connection.execute(f"PRAGMA table_info({table})")]
                column_list = ", ".join(columns)
                for row in connection.execute(f"SELECT {column_list} FROM {table} ORDER BY id"):
                    values = ", ".join(sql_literal(connection, value) for value in row)
                    handle.write(f"INSERT INTO {table} ({column_list}) VALUES ({values});\n")
            handle.write("COMMIT;\n")
    finally:
        connection.close()

    print(f"Seed geschrieben: {seed}")


def sql_literal(connection: sqlite3.Connection, value: object) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, (int, float)):
        return repr(value)
    return connection.execute("SELECT quote(?)", (value,)).fetchone()[0]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", choices=["build", "dump"])
    parser.add_argument("--db", type=Path, default=DEFAULT_DATABASE)
    parser.add_argument("--seed", type=Path, default=SEED_FILE)
    args = parser.parse_args()

    if args.command == "build":
        build(args.db, args.seed)
    else:
        dump(args.db, args.seed)
    return 0


if __name__ == "__main__":
    sys.exit(main())
