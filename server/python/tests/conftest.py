import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import pytest
from config import Config
from security.credential_store import CredentialStore
from db.connection import connect
from db.db_setup import initialize
from db.models import products, customers
from runtime import Runtime

@pytest.fixture
def runtime(tmp_path):
    config = Config(database=str(tmp_path / 'test.db'))
    secrets = CredentialStore('test')
    engine = connect(config, secrets)
    initialize(engine)
    with engine.begin() as conn:
        conn.execute(products.insert(), [dict(id='p1', name='Walking shoes', price_minor=12500, stock=2, description='Comfortable walking shoes', category='shoes'), dict(id='p2', name='Bag', price_minor=20000, stock=1, description='', category='bags')])
        conn.execute(customers.insert(), [dict(id='alice', name='Alice'), dict(id='bob', name='Bob')])
    engine.dispose()
    instance = Runtime(config, secrets)
    yield instance
    instance.close()

@pytest.fixture
def session(runtime):
    return runtime.sessions.get(runtime.sessions.create('alice'))
