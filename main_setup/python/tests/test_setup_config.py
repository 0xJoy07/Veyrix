import json
import pytest
from config import Config
from db.db_setup import initialize
from setup_ui.controller import test_database as inspect_database

def test_config_no_secrets(tmp_path):
    path = tmp_path / 'config.json'
    config = Config()
    config.save(path)
    assert Config.load(path).source == 'sqlite'
    assert 'password' not in path.read_text() and 'api_key' not in path.read_text()

@pytest.mark.parametrize('schema', ['', 'public,other', 'foo;DROP SCHEMA public', 'UPPER', 'a'*64])
def test_invalid_schema_rejected(schema):
    with pytest.raises(ValueError, match='Schema'):
        Config(database_schema=schema).validate()

def test_schema_round_trip(tmp_path):
    path = tmp_path / 'config.json'
    Config(database_schema='shopping_agent').save(path)
    assert Config.load(path).database_schema == 'shopping_agent'

def test_never_initialize_existing(runtime):
    with pytest.raises(ValueError):
        initialize(runtime.engine)
    assert runtime.catalog.get('p1')['stock'] == 2

def test_connection_report(runtime):
    report = inspect_database(runtime.config, runtime.secrets)
    assert report['checkout_enabled']
    assert 'products' in report['tables']

def test_mapped_catalog_read_only(runtime):
    from db.catalog_repository import Catalog
    from services.order_service import OrderService
    runtime.config.mapping = {'id':'id','name':'name','stock':'stock','price_minor':'price_minor'}
    catalog = Catalog(runtime.engine, runtime.config)
    assert catalog.get('p1')['name'] == 'Walking shoes'
    service = OrderService(runtime.engine, runtime.config, catalog)
    assert not service.can_write
