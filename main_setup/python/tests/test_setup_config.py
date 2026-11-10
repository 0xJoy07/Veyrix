import json
import pytest
from config import Config
from db.db_setup import initialize
from services.setup_service import test_database as inspect_database

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


@pytest.mark.parametrize('timeout', [0, 60, 1800])
def test_session_timeout_round_trip(tmp_path, timeout):
    path = tmp_path / 'config.json'
    Config(session_seconds=timeout).save(path)
    assert Config.load(path).session_seconds == timeout


@pytest.mark.parametrize('timeout', [-1, 1, 59, 60.5, True, '0', None])
def test_invalid_session_timeout_rejected(timeout):
    with pytest.raises(ValueError, match='Session timeout'):
        Config(session_seconds=timeout).validate()


def test_clear_session_does_not_fall_back_to_keyring_or_environment(monkeypatch):
    from security.credential_store import CredentialStore
    monkeypatch.setenv('GROQ_API_KEY', 'environment-key')
    secrets = CredentialStore('test-memory')
    secrets.set('groq_api_key', 'temporary-key')
    secrets.set('database_password', 'temporary-password')
    assert secrets.get('groq_api_key') == 'temporary-key'
    secrets.clear_session()
    assert secrets.session == {}
    assert secrets.get('groq_api_key') == ''
    assert secrets.get('database_password') == ''


def test_credential_store_cannot_persist_secrets():
    from security.credential_store import CredentialStore
    secrets = CredentialStore()
    with pytest.raises(ValueError, match='persistence is disabled'):
        secrets.set('groq_api_key', 'secret', persist=True)
    assert secrets.get('groq_api_key') == ''

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
