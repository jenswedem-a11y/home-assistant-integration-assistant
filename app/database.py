import os
from contextlib import contextmanager
from typing import Iterator

import psycopg
from psycopg.rows import dict_row


class DatabaseConfigError(RuntimeError):
    pass


def get_database_url() -> str:
    database_url = os.getenv("SMARTGUIDE_DATABASE_URL")
    if not database_url:
        raise DatabaseConfigError("SMARTGUIDE_DATABASE_URL fehlt.")
    return database_url


@contextmanager
def get_connection() -> Iterator[psycopg.Connection]:
    database_url = get_database_url()
    with psycopg.connect(database_url, row_factory=dict_row) as connection:
        yield connection
