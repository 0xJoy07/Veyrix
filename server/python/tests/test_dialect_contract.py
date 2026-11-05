"""SQL compilation checks supplement live SQLite/PostgreSQL tests."""
from sqlalchemy.schema import CreateTable
from sqlalchemy.dialects import mysql, postgresql, sqlite
from db.models import metadata
import pytest

@pytest.mark.parametrize('dialect', [sqlite.dialect(), postgresql.dialect(), mysql.dialect()])
def test_canonical_schema_compiles(dialect):
    for table in metadata.sorted_tables:
        sql = str(CreateTable(table).compile(dialect=dialect))
        assert 'CREATE TABLE' in sql
