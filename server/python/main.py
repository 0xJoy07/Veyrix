import argparse
from config import Config
from security.credential_store import CredentialStore

def main():
    parser = argparse.ArgumentParser(description='Shopping agent local prototype')
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('setup')
    chat = sub.add_parser('chat')
    chat.add_argument('--customer', required=True, help='Trusted local demo customer ID; not public authentication')
    customer = sub.add_parser('customer')
    customer.add_argument('--id', required=True)
    customer.add_argument('--name', required=True)
    args = parser.parse_args()
    if args.command == 'setup':
        from setup_ui.app import launch
        launch()
        return
    config = Config.load()
    secrets = CredentialStore(config.profile)
    if not secrets.get('groq_api_key') and args.command == 'chat':
        from getpass import getpass
        secrets.set('groq_api_key', getpass('Groq API key (session only): '))
    if config.source != 'sqlite' and not secrets.get('database_password'):
        from getpass import getpass
        secrets.set('database_password', getpass('Database password (session only): '))
    from runtime import Runtime
    runtime = Runtime(config, secrets)
    try:
        if args.command == 'customer':
            from db.models import customers
            runtime.orders.require_write()
            with runtime.engine.begin() as conn:
                conn.execute(customers.insert().values(id=args.id, name=args.name))
            print('Demo customer registered.')
        else:
            from cli import run
            run(runtime, args.customer)
    finally:
        runtime.close()

if __name__ == '__main__':
    try:
        main()
    except (ValueError, FileNotFoundError) as exc:
        print(str(exc))
        raise SystemExit(1)
    except Exception:
        print('Startup failed. Check setup, installed dependencies, and database availability.')
        raise SystemExit(1)
