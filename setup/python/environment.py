"""Deterministic environment-based configuration for the headless backend.

Process environment variables override the optional .env file. Secrets are never
read from the old desktop configuration or the operating-system keyring.
"""
import json
import os
from pathlib import Path

from config import Config
from security.credential_store import CredentialStore

DEFAULT_ENV_PATH = Path(__file__).resolve().parent / '.env'


def load_env_file(env_path=None):
    """Load only the selected file; never search parent directories for secrets."""
    from dotenv import load_dotenv
    path = Path(env_path).expanduser().resolve() if env_path is not None else DEFAULT_ENV_PATH
    # Literal ${...} is valid in a password; do not interpolate secret values.
    load_dotenv(dotenv_path=path, override=False, interpolate=False, encoding='utf-8-sig')
    return path


def _integer(name, default):
    raw = os.environ.get(name)
    if raw is None:
        return default
    try:
        return int(raw.strip())
    except (TypeError, ValueError):
        # Never include the supplied value in diagnostics.
        raise ValueError(f'{name} must be an integer.') from None


def load_environment(env_path=None):
    """Return (Config, CredentialStore), with process variables taking precedence."""
    path = load_env_file(env_path)
    defaults = Config()
    fields = {
        'store_name': 'SHOPPING_STORE_NAME',
        'currency': 'SHOPPING_CURRENCY',
        'source': 'SHOPPING_DB_SOURCE',
        'database': 'SHOPPING_DB_DATABASE',
        'host': 'SHOPPING_DB_HOST',
        'username': 'SHOPPING_DB_USERNAME',
        'sslmode': 'SHOPPING_DB_SSLMODE',
        'ssl_ca': 'SHOPPING_DB_SSL_CA',
        'product_table': 'SHOPPING_PRODUCT_TABLE',
        'database_schema': 'SHOPPING_DB_SCHEMA',
        'policy': 'SHOPPING_POLICY',
    }
    values = {field: os.environ.get(name, getattr(defaults, field)).strip()
              for field, name in fields.items()}
    values['model'] = os.environ.get('SHOPPING_MODEL', os.environ.get('GROQ_MODEL', '')).strip()
    values['port'] = _integer('SHOPPING_DB_PORT', 3306 if values['source'] == 'mysql' else 5432)
    values['delivery_minor'] = _integer('SHOPPING_DELIVERY_MINOR', 0)
    values['session_seconds'] = _integer('SHOPPING_SESSION_SECONDS', 0)
    try:
        values['mapping'] = json.loads(os.environ.get('SHOPPING_PRODUCT_MAPPING', '{}'))
    except (TypeError, ValueError):
        raise ValueError('SHOPPING_PRODUCT_MAPPING must be a JSON object of field names to column names.') from None
    if values['source'] == 'sqlite' and values['database']:
        database = Path(values['database']).expanduser()
        values['database'] = str((path.parent / database).resolve()) if not database.is_absolute() else str(database.resolve())
    if values['ssl_ca']:
        ca = Path(values['ssl_ca']).expanduser()
        values['ssl_ca'] = str((path.parent / ca).resolve()) if not ca.is_absolute() else str(ca.resolve())
    config = Config(**values).validate()
    secrets = CredentialStore(config.profile)
    secrets.set('groq_api_key', os.environ.get('GROQ_API_KEY', ''))
    secrets.set('database_password', os.environ.get('SHOPPING_DB_PASSWORD', ''))
    return config, secrets
