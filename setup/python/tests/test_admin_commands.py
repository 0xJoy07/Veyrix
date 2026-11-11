"""Headless provisioning through real command entry points and isolated files."""
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys


def test_environment_admin_commands_initialize_import_and_register(tmp_path):
    backend = Path(__file__).resolve().parents[1]
    database = tmp_path / 'store.db'
    settings = tmp_path / '.env'
    settings.write_text('SHOPPING_DB_SOURCE=sqlite\nSHOPPING_DB_DATABASE=store.db\n'
                        'SHOPPING_API_KEY=\nGROQ_API_KEY=\nGROQ_MODEL=\n', encoding='utf-8')
    product_file = tmp_path / 'products.json'
    product_file.write_text(json.dumps([{'id': 'demo-product', 'name': 'Test item',
                                        'price_minor': 12500, 'stock': 3}]), encoding='utf-8')
    clean_env = {key: value for key, value in os.environ.items()
                 if not key.startswith('SHOPPING_') and key not in ('GROQ_API_KEY', 'GROQ_MODEL')}

    def command(*args):
        return subprocess.run([sys.executable, str(backend / 'main.py'), '--env-file', str(settings), *args],
                              cwd=tmp_path, env=clean_env, capture_output=True, text=True, timeout=25)

    initialized = command('init-db')
    assert initialized.returncode == 0, initialized.stderr + initialized.stdout
    imported = command('import', str(product_file))
    assert imported.returncode == 0 and json.loads(imported.stdout)['imported'] == 1
    registered = command('customer', '--id', 'demo', '--name', 'Demo Customer')
    assert registered.returncode == 0 and json.loads(registered.stdout)['status'] == 'registered'
    rejected = command('init-db')
    assert rejected.returncode == 1
    with sqlite3.connect(database) as connection:
        assert connection.execute('SELECT stock FROM products').fetchone() == (3,)
        assert connection.execute('SELECT id FROM customers').fetchone() == ('demo',)
    missing_provider = command('check')
    assert missing_provider.returncode == 1
    assert 'GROQ' in missing_provider.stdout and 'Traceback' not in missing_provider.stderr
