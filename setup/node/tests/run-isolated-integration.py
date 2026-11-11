"""Run actual Prisma flows in a disposable remote schema, never production rows.

Run with setup/python/.venv/Scripts/python.exe from any directory.
Only the exact randomly generated schema created by this run is removed.
"""
import os
import re
import secrets
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit, parse_qs, urlencode

NODE = Path(__file__).resolve().parents[1]
PYTHON = NODE.parent / 'python'
sys.path.insert(0, str(PYTHON))
from dotenv import dotenv_values
from environment import load_environment
from db.connection import connect
from db.models import metadata


def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    cfg, credentials = load_environment()
    if cfg.source != 'postgresql':
        raise ValueError('Integration checks require the configured remote PostgreSQL database.')
    engine = connect(cfg, credentials)
    schema = 'veyrix_test_' + secrets.token_hex(8)
    assert re.fullmatch(r'veyrix_test_[a-f0-9]{16}', schema)
    created = False
    code = 1
    try:
        with engine.begin() as conn:
            conn.exec_driver_sql('CREATE SCHEMA ' + schema)
            conn.exec_driver_sql('SET LOCAL search_path TO ' + schema)
            metadata.create_all(conn)
            sql = (NODE / 'prisma/upgrade-existing.sql').read_text(encoding='utf-8-sig').replace('shopping_agent', schema)
            sql = sql.replace('BEGIN;\n', '', 1).rstrip()
            assert sql.endswith('COMMIT;')
            with conn.connection.driver_connection.cursor() as cursor:
                cursor.execute(sql[:-7], prepare=False)
            conn.exec_driver_sql('CREATE TABLE '+schema+'.source_products (id integer PRIMARY KEY,name text NOT NULL,description text,category text,brand text,price numeric(12,2),stock_quantity integer,is_active boolean)')
            conn.exec_driver_sql('CREATE TABLE '+schema+'.source_reviews (id integer PRIMARY KEY,product_id integer,rating smallint,comment text)')
            live_sql = (NODE / 'prisma/live-catalog.sql').read_text(encoding='utf-8-sig').replace('shopping_agent',schema).replace('public.products',schema+'.source_products').replace('public.reviews',schema+'.source_reviews')
            live_sql = live_sql.replace('BEGIN;\n','',1).rstrip()
            with conn.connection.driver_connection.cursor() as cursor:
                cursor.execute(live_sql[:-7],prepare=False)
        created = True
        print('Created isolated integration schema.', flush=True)
        env = dict(os.environ)
        values = dotenv_values(NODE / '.env', interpolate=False)
        base = urlsplit(values['DATABASE_URL'])
        query = parse_qs(base.query)
        query['schema'] = [schema]
        env['VEYRIX_TEST_DATABASE_URL'] = urlunsplit((base.scheme, base.netloc, base.path, urlencode(query, doseq=True), base.fragment))
        env['NODE_USE_SYSTEM_CA'] = '1'
        result = subprocess.run(['node', 'node_modules/tsx/dist/cli.mjs', 'tests/integration.ts'], cwd=NODE, env=env, timeout=240, capture_output=True, text=True, encoding='utf-8', errors='replace')
        output = result.stdout + result.stderr
        for value in [values.get('DATABASE_URL'), values.get('DIRECT_URL'), values.get('OTP_SECRET'), values.get('INTERNAL_API_KEY'), values.get('SHOPPING_API_KEY'), credentials.get('database_password')]:
            if value:
                output = output.replace(value, '[redacted]')
        output = re.sub(r'postgres(?:ql)?://[^\s\x22\x27]+', '[redacted connection]', output)
        print(output, flush=True)
        code = result.returncode
    except Exception as exc:
        print('Integration runner error: ' + type(exc).__name__, flush=True)
    finally:
        if created:
            with engine.begin() as conn:
                conn.exec_driver_sql('DROP SCHEMA ' + schema + ' CASCADE')
            print('Removed only the isolated test schema.', flush=True)
        engine.dispose()
        credentials.clear_session()
    return code


if __name__ == '__main__':
    raise SystemExit(main())

