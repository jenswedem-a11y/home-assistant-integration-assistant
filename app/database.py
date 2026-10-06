import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

DEFAULT_DATABASE_PATH = Path(__file__).resolve().parent.parent / "catalog" / "smartguide.db"


class DatabaseConfigError(RuntimeError):
    pass


def get_database_path() -> Path:
    database_path = Path(os.getenv("SMARTGUIDE_DATABASE_PATH") or DEFAULT_DATABASE_PATH)
    if not database_path.is_file():
        raise DatabaseConfigError(f"Gerätedatenbank nicht gefunden: {database_path}")
    return database_path


@contextmanager
def get_connection() -> Iterator[sqlite3.Connection]:
    # The catalog is read-only at runtime; it is built into the image.
    database_uri = f"{get_database_path().as_uri()}?mode=ro"
    connection = sqlite3.connect(database_uri, uri=True)
    connection.row_factory = sqlite3.Row
    try:
        yield connection
    finally:
        connection.close()
