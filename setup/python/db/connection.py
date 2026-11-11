from pathlib import Path
from sqlalchemy import create_engine, event, URL

def connect(config, secrets):
    config.validate()
    if config.source == 'sqlite':
        path = Path(config.database).expanduser().resolve()
        path.parent.mkdir(parents=True, exist_ok=True)
        engine = create_engine(URL.create('sqlite', database=str(path)), connect_args={'timeout': 20}, hide_parameters=True)
        @event.listens_for(engine, 'connect')
        def pragma(connection, _):
            connection.execute('PRAGMA foreign_keys=ON')
            connection.execute('PRAGMA busy_timeout=20000')
        return engine
    driver = 'postgresql+psycopg' if config.source == 'postgresql' else 'mysql+pymysql'
    args = {'connect_timeout': 10}
    if config.source == 'postgresql':
        args['sslmode'] = config.sslmode
        if config.ssl_ca:
            args['sslrootcert'] = config.ssl_ca
    elif config.sslmode != 'disable':
        args['ssl'] = {'check_hostname': True}
        if config.ssl_ca:
            args['ssl']['ca'] = config.ssl_ca
    engine = create_engine(URL.create(driver, username=config.username, password=secrets.get('database_password'),
        host=config.host, port=config.port, database=config.database), connect_args=args,
        pool_pre_ping=True, hide_parameters=True)
    if config.source == 'postgresql':
        @event.listens_for(engine, 'connect', insert=True)
        def select_schema(connection, _):
            # Session poolers preserve this setting. Commit it outside transactions
            # so rollback cannot silently send later operations to public.
            previous = connection.autocommit
            connection.autocommit = True
            try:
                with connection.cursor() as cursor:
                    cursor.execute('SELECT 1 FROM pg_namespace WHERE nspname = %s', (config.database_schema,))
                    if cursor.fetchone() is None:
                        raise ValueError('Selected PostgreSQL schema does not exist. Create it before connecting.')
                    cursor.execute('SELECT set_config(%s, %s, false)', ('search_path', config.database_schema))
            finally:
                connection.autocommit = previous
    return engine
