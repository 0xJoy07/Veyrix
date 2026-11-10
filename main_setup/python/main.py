"""Headless application orchestration shared by Flask and administrative commands."""
import argparse
import json
from threading import Lock

from agent.agent import ProviderUnavailable
from api import PreparedApplication, ShoppingAPI, prepare_application
from memory.session_store import SessionNotFound


class BackendApplication:
    """Own one runtime and its RAM-only sessions for the server process.

    The HTTP layer authenticates the upstream caller. Customer identities are
    trusted upstream inputs; clients cannot replace a session's identity/history.
    Current catalog facts come from the runtime's database-backed tools.
    """
    def __init__(self, prepared, model=None):
        if prepared.report.get('status') != 'ready':
            prepared.close()
            raise ValueError('Backend preparation did not complete.')
        self.prepared = prepared
        self.runtime, self.report = prepared.runtime, prepared.report
        self.api = ShoppingAPI(self.runtime, model=model)
        self.closed = False
        self._close_lock = Lock()

    def _require_open(self):
        if self.closed:
            raise ProviderUnavailable('The backend is shutting down.')

    @staticmethod
    def _session_id(session_id):
        if not isinstance(session_id, str) or not session_id.strip() or len(session_id) > 100:
            raise ValueError('Provide a valid session ID.')
        return session_id

    def start_session(self, customer_id):
        self._require_open()
        return self.api.start_session(customer_id)

    def chat(self, message, session_id=None, customer_id=None):
        self._require_open()
        if not isinstance(message, str) or not message.strip() or len(message) > 8000:
            raise ValueError('Enter a message between 1 and 8000 characters.')
        new_session = session_id is None
        if new_session:
            session_id = self.start_session(customer_id)
        else:
            self._session_id(session_id)
            if customer_id is not None:
                raise ValueError('Customer identity cannot be supplied for an existing session.')
        try:
            return self.api.chat(session_id, message, raise_provider_errors=True)
        except BaseException:
            # The caller never received this generated ID, so do not leak a
            # failed first request's otherwise unreachable session into memory.
            if new_session:
                self.api.close_session(session_id)
            raise

    def reset_session(self, session_id):
        self._require_open()
        return self.api.reset_session(self._session_id(session_id))

    def close_session(self, session_id):
        self._require_open()
        session_id = self._session_id(session_id)
        with self.runtime.sessions.use(session_id):
            self.api.close_session(session_id)

    def confirm(self, session_id, token):
        self._require_open()
        if not isinstance(token, str) or not token.strip() or len(token) > 100:
            raise ValueError('Provide a valid confirmation ID.')
        return self.api.confirm(self._session_id(session_id), token)

    def close(self):
        with self._close_lock:
            if self.closed:
                return
            self.closed = True
            self.prepared.close()


def create_application(env_path=None, *, config=None, secrets=None, model=None, verify_groq=True, progress_callback=None):
    """Load environment settings and prepare a single backend, without any UI.

    Explicit config/secrets/model injection supports isolated tests. Production
    callers omit these parameters and use environment.py's deterministic loader.
    """
    if (config is None) != (secrets is None):
        raise ValueError('Provide config and secrets together.')
    if config is None:
        from environment import load_environment
        config, secrets = load_environment(env_path)
    try:
        prepared = prepare_application(config, secrets, progress_callback=progress_callback, verify_groq=verify_groq)
        return BackendApplication(prepared, model=model)
    except BaseException:
        secrets.clear_session()
        raise


def register_customer(runtime, customer_id, name):
    from sqlalchemy import select
    from sqlalchemy.exc import IntegrityError
    from db.models import customers
    if not isinstance(customer_id, str) or not isinstance(name, str):
        raise ValueError('Customer ID and name must be text.')
    customer_id, name = customer_id.strip(), name.strip()
    if not customer_id or not name or len(customer_id) > 100 or len(name) > 250:
        raise ValueError('Enter a customer ID (1–100 characters) and name (1–250 characters).')
    runtime.orders.require_write()
    try:
        with runtime.engine.begin() as conn:
            if conn.execute(select(customers.c.id).where(customers.c.id == customer_id)).first():
                raise ValueError('Customer already exists.')
            conn.execute(customers.insert().values(id=customer_id, name=name))
    except IntegrityError:
        raise ValueError('Customer could not be registered; check whether the ID already exists.') from None


def main(argv=None):
    parser = argparse.ArgumentParser(description='Shopping Agent headless backend')
    parser.add_argument('--env-file', help='Explicit .env path; defaults to the Python project .env')
    sub = parser.add_subparsers(dest='command')
    sub.add_parser('serve', help='Run the Flask application using Waitress')
    sub.add_parser('check', help='Validate database, catalog and Groq configuration')
    sub.add_parser('init-db', help='Initialize the selected empty application database')
    importer = sub.add_parser('import', help='Import a product or review CSV/JSON file')
    importer.add_argument('path')
    importer.add_argument('--kind', choices=('products', 'reviews'), default='products')
    importer.add_argument('--mapping', default='{}', help='JSON canonical-field to source-column mapping')
    customer = sub.add_parser('customer', help='Register a customer for trusted backend use')
    customer.add_argument('--id', required=True)
    customer.add_argument('--name', required=True)
    args = parser.parse_args(argv)
    if args.command in (None, 'serve'):
        from api.flask import serve
        return serve(env_path=args.env_file)

    from environment import load_environment
    config, secrets = load_environment(args.env_file)
    application = None
    try:
        if args.command == 'init-db':
            from services.setup_service import initialize_database
            result = initialize_database(config, secrets)
        elif args.command == 'import':
            from services.setup_service import import_file
            try:
                mapping = json.loads(args.mapping)
            except (ValueError, TypeError):
                raise ValueError('Import mapping must be a JSON object.') from None
            if not isinstance(mapping, dict):
                raise ValueError('Import mapping must be a JSON object.')
            result = import_file(config, secrets, args.path, mapping, args.kind)
        else:
            application = create_application(config=config, secrets=secrets, verify_groq=args.command == 'check')
            if args.command == 'customer':
                register_customer(application.runtime, args.id, args.name)
                result = {'status': 'registered', 'customer_id': args.id}
            else:
                # Do not dump business data or credentials into terminal logs.
                result = {key: application.report[key] for key in ('status', 'counts', 'checks')}
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return result
    finally:
        if application is not None:
            application.close()
        secrets.clear_session()


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        raise SystemExit(0)
    except ValueError as exc:
        print(str(exc))
        raise SystemExit(1)
    except Exception as exc:
        from services.errors import describe_startup_error
        print(describe_startup_error(exc))
        raise SystemExit(1)
