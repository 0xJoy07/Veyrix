"""Exercise hostile SQL-looking data against an actual isolated SQLite database."""
import json

import pytest
from sqlalchemy import event, select
from sqlalchemy.exc import NoSuchTableError

from config import Config
from db.account_repository import AccountRepository
from db.catalog_repository import Catalog
from db.importers.files import import_records
from db.models import orders, products


PAYLOAD = "x'; DROP TABLE products; --"


def test_imported_product_and_search_are_bound_literal_data(runtime, tmp_path):
    path = tmp_path / 'products.json'
    path.write_text(json.dumps([dict(id=PAYLOAD, name=PAYLOAD, price_minor=100, stock=1)]))
    captured = []

    def capture(conn, cursor, statement, parameters, context, many):
        captured.append((statement, parameters))

    event.listen(runtime.engine, 'before_cursor_execute', capture)
    try:
        assert import_records(runtime.engine, path) == 1
        assert runtime.catalog.get(PAYLOAD)['id'] == PAYLOAD
        assert [row['id'] for row in runtime.catalog.search(PAYLOAD)] == [PAYLOAD]
        with runtime.engine.connect() as conn:
            assert set(conn.execute(select(products.c.id)).scalars()) == {'p1', 'p2', PAYLOAD}
    finally:
        event.remove(runtime.engine, 'before_cursor_execute', capture)
    assert all(PAYLOAD not in statement for statement, _ in captured)
    assert any(PAYLOAD in str(parameters) for _, parameters in captured)


def test_sql_looking_order_and_customer_ids_cannot_bypass_ownership(runtime):
    with runtime.engine.begin() as conn:
        conn.execute(orders.insert(), dict(id=PAYLOAD, customer_id='bob', request_id='request',
            status='confirmed', total_minor=100, currency='INR', address='Test', created_at='2026-01-01'))
    accounts = AccountRepository(runtime.engine)
    assert accounts.orders('alice', PAYLOAD) == []
    assert accounts.orders("bob' OR '1'='1", PAYLOAD) == []
    assert accounts.orders('bob', "' OR 1=1 --") == []
    assert accounts.orders('bob', PAYLOAD)[0]['id'] == PAYLOAD


def test_hostile_dynamic_table_name_is_not_executed(runtime):
    config = Config(database=runtime.config.database, product_table=PAYLOAD)
    with pytest.raises(NoSuchTableError):
        Catalog(runtime.engine, config)
    assert runtime.catalog.get('p1')['id'] == 'p1'


@pytest.mark.parametrize('schema', ['public"; DROP TABLE products; --', 'public,private', 'public\nSELECT 1'])
def test_hostile_schema_identifiers_are_rejected_before_connecting(schema):
    with pytest.raises(ValueError, match='Schema'):
        Config(database_schema=schema).validate()
