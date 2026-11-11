"""Opt-in isolated real PostgreSQL contract test; never touches an existing server.

Set SHOPPING_TEST_POSTGRES_BIN to a directory containing initdb and pg_ctl.
"""
import os
import socket
import subprocess
from pathlib import Path
import pytest
from config import Config
from db.connection import connect
from db.db_setup import initialize
from db.models import customers, products
from security.credential_store import CredentialStore
from runtime import Runtime

@pytest.mark.skipif(not os.environ.get('SHOPPING_TEST_POSTGRES_BIN'), reason='Opt-in PostgreSQL binaries not configured')
def test_postgres_transaction_contract(tmp_path):
    binaries = Path(os.environ['SHOPPING_TEST_POSTGRES_BIN'])
    suffix = '.exe' if os.name == 'nt' else ''
    data = tmp_path / 'pgdata'
    flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
    def command(name, *args):
        # Do not PIPE output: Windows server descendants can inherit pipe handles
        # and prevent communicate() from finishing even after pg_ctl has exited.
        with (tmp_path / 'commands.log').open('a') as log:
            return subprocess.run([str(binaries / (name + suffix)), *map(str, args)], check=True,
                                  stdout=log, stderr=log, stdin=subprocess.DEVNULL,
                                  text=True, creationflags=flags, timeout=60)
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    command('initdb', '-D', data, '-U', 'shopping_test', '--auth=trust', '--encoding=UTF8', '--no-locale')
    command('pg_ctl', '-D', data, '-l', tmp_path / 'server.log', '-o', f'-h 127.0.0.1 -p {port}', '-w', 'start')
    runtime = None
    try:
        config = Config(source='postgresql', database='postgres', host='127.0.0.1', port=port,
                        username='shopping_test', sslmode='disable')
        secrets = CredentialStore('integration')
        engine = connect(config, secrets)
        initialize(engine)
        with engine.begin() as conn:
            conn.execute(customers.insert().values(id='test', name='Test Customer'))
            conn.execute(products.insert().values(id='p1', name='Product', price_minor=100, stock=1))
        engine.dispose()
        runtime = Runtime(config, secrets)
        session = runtime.sessions.get(runtime.sessions.create('test'))
        runtime.cart.set_item(session, 'p1', 1)
        pending = runtime.orders.prepare(session, '123 Test Road')
        order = runtime.orders.confirm(session, pending['confirmation_id'])
        assert runtime.catalog.get('p1')['stock'] == 0
        pending = runtime.orders.prepare_cancel(session, order['order_id'])
        runtime.orders.confirm(session, pending['confirmation_id'])
        assert runtime.catalog.get('p1')['stock'] == 1
    finally:
        if runtime:
            runtime.close()
        command('pg_ctl', '-D', data, '-m', 'immediate', '-w', 'stop')
