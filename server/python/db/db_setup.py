from sqlalchemy import inspect, select
from db.models import metadata, version

def initialize(engine):
    """Only initialize an empty, explicitly selected application database."""
    if inspect(engine).get_table_names():
        raise ValueError('Database is not empty. Initialization refused; connect without initializing.')
    metadata.create_all(engine)
    with engine.begin() as conn:
        conn.execute(version.insert().values(version=1))

def writable(engine):
    inspector = inspect(engine)
    if 'shopping_schema' not in inspector.get_table_names():
        return False
    for table in metadata.sorted_tables:
        if not inspector.has_table(table.name):
            return False
        if not set(table.c.keys()) <= {c['name'] for c in inspector.get_columns(table.name)}:
            return False
    with engine.connect() as conn:
        return conn.execute(select(version.c.version)).scalars().all() == [1]
