"""Private LangChain worker startup, without a legacy HTTP/session adapter."""
import logging
import os
import sys
from pathlib import Path

if __package__ in (None, ''):
    _api_directory = Path(__file__).resolve().parent
    sys.path[:] = [entry for entry in sys.path if Path(entry or '.').resolve() != _api_directory]
    sys.path.insert(0, str(_api_directory.parent))


def startup_progress(event):
    """Print only known stage/status labels, never provider text or secret data."""
    stages = {'settings': 'Checking settings', 'database': 'Connecting to database',
              'products': 'Fetching products', 'reviews': 'Fetching reviews',
              'groq': 'Checking Groq connection', 'ready': 'Backend preparation'}
    status = event.get('status')
    stage = stages.get(event.get('step'))
    if stage and status in {'running', 'completed', 'failed', 'skipped'}:
        print(f'[startup] {stage}: {status}', flush=True)


def create_app(api_key=None, *, env_path=None, progress_callback=startup_progress):
    from api.stateless import create_stateless_app
    return create_stateless_app(api_key=api_key, env_path=env_path)


def serve(env_path=None):
    """Run a single-process Waitress server; no Flask debugger or reloader."""
    from environment import load_env_file
    load_env_file(env_path)
    host = os.environ.get('SHOPPING_HOST', '127.0.0.1').strip()
    if not host or any(char.isspace() for char in host) or '://' in host or '/' in host:
        raise ValueError('SHOPPING_HOST must be a hostname or IP address.')
    try:
        port = int(os.environ.get('SHOPPING_PORT', '8000'))
        if not 1 <= port <= 65535:
            raise ValueError()
    except ValueError:
        raise ValueError('SHOPPING_PORT must be an integer from 1 to 65535.') from None
    from waitress import serve as run_server
    print('[startup] Preparing stateless shopping assistant; customer data stays in Supabase.', flush=True)
    app = create_app(env_path=env_path)
    # Waitress emits its actual listening address after socket creation succeeds.
    logger = logging.getLogger('waitress')
    logger.setLevel(logging.INFO)
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter('%(message)s'))
        logger.addHandler(handler)
        logger.propagate = False
    print('[startup] Starting HTTP listener. Keep this terminal open; Ctrl+C stops the server.', flush=True)
    try:
        from api.stateless import MAX_BODY_BYTES as STATELESS_MAX_BODY_BYTES
        run_server(app, host=host, port=port, threads=4, max_request_body_size=STATELESS_MAX_BODY_BYTES)
    finally:
        app.extensions['shopping_shutdown']()


if __name__ == '__main__':
    try:
        serve()
    except KeyboardInterrupt:
        pass
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)
    except Exception as exc:
        from services.errors import describe_startup_error
        print(describe_startup_error(exc), file=sys.stderr)
        raise SystemExit(1)
