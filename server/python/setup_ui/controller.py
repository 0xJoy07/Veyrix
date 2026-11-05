import json
from sqlalchemy import inspect, text
from db.connection import connect
from db.db_setup import initialize, writable
from db.catalog_repository import Catalog
from db.importers.files import read_file, import_records

def test_database(config, secrets):
    engine = connect(config, secrets)
    try:
        with engine.connect() as conn:
            conn.execute(text('SELECT 1'))
        tables = inspect(engine).get_table_names()
        result = {'connected': True, 'tables': {t: [c['name'] for c in inspect(engine).get_columns(t)] for t in tables}}
        if config.product_table in tables:
            catalog = Catalog(engine, config)
            result['products_preview'] = catalog.search()[:5]
            result['checkout_enabled'] = writable(engine) and config.product_table == 'products' and not config.mapping
        return result
    finally:
        engine.dispose()

def initialize_database(config, secrets):
    engine = connect(config, secrets)
    try:
        initialize(engine)
        return {'message': 'Application database created. Import products next.'}
    finally:
        engine.dispose()

def import_file(config, secrets, path, mapping, kind):
    engine = connect(config, secrets)
    try:
        if not writable(engine):
            raise ValueError('Imports require an initialized application database.')
        return {'imported': import_records(engine, path, mapping, kind)}
    finally:
        engine.dispose()
