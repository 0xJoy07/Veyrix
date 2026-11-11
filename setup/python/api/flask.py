"""Start the stateless assistant; retain an injected legacy adapter for tests.

The bearer key authenticates the trusted Node service, which verifies the user
and owns all persistent state through Prisma/Supabase. Never embed this server
key in a browser. Normal startup delegates to api.stateless without a local DB.
"""
import atexit
import hmac
import logging
import os
import sys
from pathlib import Path
from threading import Lock

# Direct execution must not let this filename shadow the installed flask package.
if __package__ in (None, ''):
    _api_directory = Path(__file__).resolve().parent
    sys.path[:] = [entry for entry in sys.path
                   if Path(entry or '.').resolve() != _api_directory]
    sys.path.insert(0, str(_api_directory.parent))

from flask import Flask, jsonify, request
from werkzeug.exceptions import HTTPException, BadRequest, UnsupportedMediaType


MAX_BODY_BYTES = 64 * 1024


def _text(body, key, maximum=100):
    value = body.get(key)
    if not isinstance(value, str) or not value.strip() or len(value) > maximum:
        raise BadRequest(f'{key} must be a nonempty string of at most {maximum} characters.')
    return value


def _body(allowed, required=(), optional_empty=False):
    if optional_empty and not request.get_data(cache=True):
        return {}
    if not request.is_json:
        raise UnsupportedMediaType('Send application/json.')
    value = request.get_json()
    if not isinstance(value, dict):
        raise BadRequest('The request body must be a JSON object.')
    if set(value) - set(allowed):
        raise BadRequest('The request contains unsupported fields.')
    if set(required) - set(value):
        raise BadRequest('The request is missing required fields.')
    return value


def startup_progress(event):
    """Print only known stage/status labels, never provider text or secret data."""
    stages = {'settings': 'Checking settings', 'database': 'Connecting to database',
              'products': 'Fetching products', 'reviews': 'Fetching reviews',
              'groq': 'Checking Groq connection', 'ready': 'Backend preparation'}
    status = event.get('status')
    stage = stages.get(event.get('step'))
    if stage and status in {'running', 'completed', 'failed', 'skipped'}:
        print(f'[startup] {stage}: {status}', flush=True)


def create_app(application=None, api_key=None, *, env_path=None, progress_callback=startup_progress):
    """Create the stateless worker, or an explicitly injected legacy test adapter.

    WSGI deployment can use ``api.flask:create_app()``. The deployed default does
    not initialize main.BackendApplication, a local database, or session memory.
    """
    # The deployed worker is stateless. Explicit application injection is kept
    # for isolated legacy tests/admin integrations, never selected by startup.
    if application is None:
        from api.stateless import create_stateless_app
        return create_stateless_app(api_key=api_key, env_path=env_path)
    if api_key is None:
        from environment import load_env_file
        load_env_file(env_path)
    key = api_key if api_key is not None else os.environ.get('SHOPPING_API_KEY', '')
    if not isinstance(key, str) or not key.strip():
        raise ValueError('Set SHOPPING_API_KEY before starting the backend server.')
    if len(key) < 32:
        raise ValueError('SHOPPING_API_KEY must contain at least 32 characters.')
    if any(char.isspace() for char in key):
        raise ValueError('SHOPPING_API_KEY must not contain whitespace.')
    key_bytes = key.encode('utf-8')

    from main import create_application, SessionNotFound, ProviderUnavailable
    if application is None:
        application = create_application(env_path=env_path, progress_callback=progress_callback)

    app = Flask(__name__, static_folder=None)
    app.config.update(MAX_CONTENT_LENGTH=MAX_BODY_BYTES, DEBUG=False, TESTING=False)
    app.extensions['shopping_application'] = application
    close_lock = Lock()
    closed = False

    def shutdown():
        nonlocal closed
        with close_lock:
            if not closed:
                closed = True
                application.close()

    app.extensions['shopping_shutdown'] = shutdown
    atexit.register(shutdown)

    def error_response(code, message, status):
        return jsonify(error={'code': code, 'message': message}), status

    @app.before_request
    def authenticate():
        if request.path == '/api' or request.path.startswith('/api/'):
            scheme, _, supplied = request.headers.get('Authorization', '').partition(' ')
            if scheme.lower() != 'bearer' or not hmac.compare_digest(supplied.encode('utf-8'), key_bytes):
                response, status = error_response('unauthorized', 'A valid server bearer key is required.', 401)
                response.headers['WWW-Authenticate'] = 'Bearer'
                return response, status
        if request.content_length is not None and request.content_length > MAX_BODY_BYTES:
            return error_response('request_too_large', 'Request body exceeds 64 KiB.', 413)

    @app.after_request
    def prevent_caching(response):
        response.headers['Cache-Control'] = 'no-store'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        return response

    @app.get('/health')
    def health():
        ready = (not closed and application.report.get('status') == 'ready'
                 and not getattr(application.runtime, 'closed', False))
        return jsonify(status='ok' if ready else 'unavailable'), 200 if ready else 503

    @app.post('/api/chat')
    def chat():
        body = _body({'message', 'session_id', 'customer_id'}, {'message'})
        message = _text(body, 'message', 8000)
        if 'session_id' in body:
            session_id = _text(body, 'session_id')
            if 'customer_id' in body:
                raise BadRequest('Do not supply customer_id for an existing session.')
            return jsonify(application.chat(message, session_id=session_id))
        customer_id = _text(body, 'customer_id')
        return jsonify(application.chat(message, customer_id=customer_id))

    @app.post('/api/sessions')
    def start_session():
        body = _body({'customer_id'}, {'customer_id'})
        session_id = application.start_session(_text(body, 'customer_id'))
        return jsonify(session_id=session_id), 201

    @app.delete('/api/sessions/<session_id>')
    def close_session(session_id):
        _text({'session_id': session_id}, 'session_id')
        _body(set(), optional_empty=True)
        application.close_session(session_id)
        return jsonify(status='closed', session_id=session_id)

    @app.post('/api/sessions/<session_id>/reset')
    def reset_session(session_id):
        _text({'session_id': session_id}, 'session_id')
        _body(set(), optional_empty=True)
        new_session_id = application.reset_session(session_id)
        return jsonify(status='reset', session_id=new_session_id)

    @app.post('/api/sessions/<session_id>/confirm')
    def confirm(session_id):
        _text({'session_id': session_id}, 'session_id')
        body = _body({'confirmation_id'}, {'confirmation_id'})
        return jsonify(application.confirm(session_id, _text(body, 'confirmation_id')))

    @app.errorhandler(SessionNotFound)
    def missing_session(exc):
        return error_response('session_not_found', 'Session was not found or has expired. Start a new session.', 404)

    @app.errorhandler(ProviderUnavailable)
    def unavailable_provider(exc):
        return error_response('provider_unavailable', 'The chat provider is unavailable. Try again later.', 503)

    @app.errorhandler(ValueError)
    def invalid_operation(exc):
        # Driver/provider messages can contain secrets; never serialize arbitrary exceptions.
        return error_response('invalid_request', 'The operation could not be completed. Check the supplied values and current session state.', 400)

    @app.errorhandler(HTTPException)
    def http_error(exc):
        messages = {
            400: ('invalid_request', 'The request is malformed or contains invalid fields.'),
            404: ('not_found', 'The requested endpoint was not found.'),
            405: ('method_not_allowed', 'This method is not supported for the endpoint.'),
            413: ('request_too_large', 'Request body exceeds 64 KiB.'),
            415: ('unsupported_media_type', 'Send application/json.'),
        }
        code, message = messages.get(exc.code, ('http_error', 'The HTTP request could not be completed.'))
        return error_response(code, message, exc.code or 500)

    @app.errorhandler(Exception)
    def unexpected_error(exc):
        # Do not log exception text or a traceback containing credentials/request data.
        app.logger.error('A shopping backend request failed (%s).', type(exc).__name__)
        return error_response('internal_error', 'The backend could not complete the request.', 500)

    return app


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
