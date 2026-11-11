"""Headless environment configuration, precedence and secret handling."""
import json
import os
from dataclasses import asdict

import pytest

import environment
from config import Config


@pytest.fixture(autouse=True)
def isolated_environment(monkeypatch):
    values = {key: value for key, value in os.environ.items()
              if not key.startswith('SHOPPING_') and key not in ('GROQ_API_KEY', 'GROQ_MODEL')}
    monkeypatch.setattr(os, 'environ', values)


def test_dotenv_loads_config_and_literal_credentials(tmp_path):
    path = tmp_path / '.env'
    path.write_text('''SHOPPING_STORE_NAME=Example Store
SHOPPING_DB_SOURCE=postgresql
SHOPPING_DB_DATABASE=postgres
SHOPPING_DB_HOST=example.invalid
SHOPPING_DB_USERNAME=store_user
SHOPPING_DB_PASSWORD=' password#${UNEXPANDED} '
SHOPPING_DB_SCHEMA=shopping_agent
GROQ_MODEL=model-from-env
GROQ_API_KEY=private-model-key
SHOPPING_API_KEY=private-server-key
SHOPPING_SESSION_SECONDS=0
SHOPPING_PRODUCT_MAPPING={"id":"sku","name":"title","price":"amount","stock":"qty"}
''', encoding='utf-8')
    config, secrets = environment.load_environment(path)
    assert config.store_name == 'Example Store'
    assert config.database_schema == 'shopping_agent'
    assert config.model == 'model-from-env'
    assert config.mapping['id'] == 'sku'
    assert secrets.get('database_password') == ' password#${UNEXPANDED} '
    assert secrets.get('groq_api_key') == 'private-model-key'
    assert os.environ['SHOPPING_API_KEY'] == 'private-server-key'
    serialized = json.dumps(asdict(config))
    assert 'private-' not in serialized and 'password#' not in serialized


def test_process_environment_overrides_file(tmp_path, monkeypatch):
    path = tmp_path / '.env'
    path.write_text('GROQ_API_KEY=file-key\nGROQ_MODEL=file-model\nSHOPPING_STORE_NAME=File Store\n', encoding='utf-8')
    monkeypatch.setenv('GROQ_API_KEY', 'process-key')
    monkeypatch.setenv('SHOPPING_MODEL', 'process-model')
    monkeypatch.setenv('SHOPPING_STORE_NAME', 'Process Store')
    config, secrets = environment.load_environment(path)
    assert config.store_name == 'Process Store'
    assert config.model == 'process-model'
    assert secrets.get('groq_api_key') == 'process-key'


def test_missing_optional_file_does_not_read_legacy_config(tmp_path, monkeypatch):
    monkeypatch.setattr(Config, 'load', lambda *args: pytest.fail('Legacy config must not load'))
    config, secrets = environment.load_environment(tmp_path / '.env')
    assert config.session_seconds == 0
    assert config.source == 'sqlite'
    assert secrets.get('groq_api_key') == ''
    assert secrets.get('database_password') == ''


def test_default_file_is_independent_of_working_directory(tmp_path, monkeypatch):
    backend = tmp_path / 'backend'
    backend.mkdir()
    path = backend / '.env'
    path.write_text('SHOPPING_DB_DATABASE=data/catalog.db\nSHOPPING_STORE_NAME=Correct File\n', encoding='utf-8')
    (tmp_path / '.env').write_text('SHOPPING_STORE_NAME=Wrong File\n', encoding='utf-8')
    monkeypatch.setattr(environment, 'DEFAULT_ENV_PATH', path)
    monkeypatch.chdir(tmp_path)
    config, _ = environment.load_environment()
    assert config.store_name == 'Correct File'
    assert config.database == str((backend / 'data/catalog.db').resolve())


@pytest.mark.parametrize('name', ['SHOPPING_DB_PORT', 'SHOPPING_DELIVERY_MINOR', 'SHOPPING_SESSION_SECONDS'])
def test_invalid_integer_hides_value(tmp_path, monkeypatch, name):
    monkeypatch.setenv(name, 'private-secret-value')
    with pytest.raises(ValueError) as exc:
        environment.load_environment(tmp_path / '.env')
    assert name in str(exc.value)
    assert 'private-secret-value' not in str(exc.value)


@pytest.mark.parametrize('mapping', ['private-secret-invalid-json', '[]', 'null', '{"id":4}'])
def test_invalid_mapping_is_rejected_without_echoing_input(tmp_path, monkeypatch, mapping):
    monkeypatch.setenv('SHOPPING_PRODUCT_MAPPING', mapping)
    with pytest.raises(ValueError) as exc:
        environment.load_environment(tmp_path / '.env')
    assert 'private-secret' not in str(exc.value)


def test_mysql_defaults_to_3306(tmp_path, monkeypatch):
    monkeypatch.setenv('SHOPPING_DB_SOURCE', 'mysql')
    monkeypatch.setenv('SHOPPING_DB_USERNAME', 'test-user')
    config, _ = environment.load_environment(tmp_path / '.env')
    assert config.port == 3306


def test_clear_session_leaves_supplied_environment_unchanged(tmp_path, monkeypatch):
    monkeypatch.setenv('GROQ_API_KEY', 'process-key')
    _, secrets = environment.load_environment(tmp_path / '.env')
    secrets.clear_session()
    assert secrets.get('groq_api_key') == ''
    assert os.environ['GROQ_API_KEY'] == 'process-key'
