"""Private stateless HTTP worker; Node/Prisma is the sole state owner."""
import hmac
import os
import time
from datetime import datetime, timezone

from flask import Flask, jsonify, request, g
from werkzeug.exceptions import HTTPException

from agent.agent import ProviderUnavailable
from agent.stateless import CommerceTools, StatelessAssistant

MAX_BODY_BYTES = 256 * 1024


def _key(value, label):
    if not isinstance(value, str) or len(value) < 32:
        raise ValueError(f'{label} must contain at least 32 characters.')
    if any(char.isspace() for char in value):
        raise ValueError(f'{label} must not contain whitespace.')
    return value


def create_stateless_app(*, assistant=None, api_key=None, env_path=None):
    if assistant is None or api_key is None:
        from environment import load_env_file
        load_env_file(env_path)
    key = _key(api_key if api_key is not None else os.environ.get('SHOPPING_API_KEY', ''), 'SHOPPING_API_KEY')
    if assistant is None:
        internal_key = _key(os.environ.get('INTERNAL_API_KEY', ''), 'INTERNAL_API_KEY')
        groq_key = os.environ.get('GROQ_API_KEY', '').strip()
        model_id = os.environ.get('GROQ_MODEL', os.environ.get('SHOPPING_MODEL', '')).strip()
        if not groq_key or not model_id:
            raise ValueError('Set GROQ_API_KEY and GROQ_MODEL for the shopping assistant.')
        from langchain_groq import ChatGroq
        model = ChatGroq(model=model_id, api_key=groq_key, temperature=0, timeout=30,
                         max_retries=1, max_tokens=1500)
        assistant = StatelessAssistant(model, CommerceTools(
            os.environ.get('COMMERCE_API_URL', 'http://127.0.0.1:8001'), internal_key))
    app = Flask(__name__, static_folder=None)
    app.config.update(MAX_CONTENT_LENGTH=MAX_BODY_BYTES, DEBUG=False)
    closed = False

    def shutdown():
        nonlocal closed
        closed = True

    app.extensions['shopping_shutdown'] = shutdown

    def error(code, message, status):
        return jsonify(error={'code': code, 'message': message}), status

    @app.before_request
    def authenticate():
        g.request_started = time.monotonic()
        if request.path.startswith('/api/'):
            scheme, _, supplied = request.headers.get('Authorization', '').partition(' ')
            if scheme.lower() != 'bearer' or not hmac.compare_digest(supplied.encode(), key.encode()):
                response, status = error('unauthorized', 'A valid server bearer key is required.', 401)
                response.headers['WWW-Authenticate'] = 'Bearer'
                return response, status
        if closed:
            return error('unavailable', 'The assistant is shutting down.', 503)

    @app.after_request
    def no_cache(response):
        elapsed = int((time.monotonic() - getattr(g, 'request_started', time.monotonic())) * 1000)
        route = request.url_rule.rule if request.url_rule else 'unmatched'
        print(f'[python] {datetime.now(timezone.utc).isoformat()} {request.method} {route} {response.status_code} {elapsed}ms', flush=True)
        response.headers['Cache-Control'] = 'no-store'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        return response

    @app.get('/health')
    def health():
        return jsonify(status='ok', mode='stateless')

    @app.post('/api/respond')
    def respond():
        if not request.is_json:
            return error('unsupported_media_type', 'Send application/json.', 415)
        body = request.get_json()
        fields = {'chat_id', 'customer_id', 'turn_id', 'message', 'history'}
        if not isinstance(body, dict) or set(body) != fields:
            return error('invalid_request', 'Provide chat_id, customer_id, turn_id, message and history.', 400)
        for name, maximum in (('chat_id', 100), ('customer_id', 100), ('turn_id', 100), ('message', 8000)):
            value = body[name]
            if not isinstance(value, str) or not value.strip() or len(value) > maximum:
                return error('invalid_request', 'The request contains invalid text fields.', 400)
        history = body['history']
        if not isinstance(history, list) or len(history) > 100:
            return error('invalid_request', 'History must contain at most 100 messages.', 400)
        normalized = []
        for item in history:
            if isinstance(item, (list, tuple)) and len(item) == 2:
                item = {'role': item[0], 'content': item[1]}
            if (not isinstance(item, dict) or item.get('role') not in ('user', 'human', 'assistant', 'ai')
                    or not isinstance(item.get('content'), str) or len(item['content']) > 32000):
                return error('invalid_request', 'History contains an invalid message.', 400)
            # Node retains the complete transcript. Bound only the model context,
            # including earlier assistant replies larger than new user inputs.
            normalized.append({'role': item['role'], 'content': item['content'][:8000]})
        return jsonify(assistant.respond(body['chat_id'], body['customer_id'], body['message'], normalized, body['turn_id']))

    @app.errorhandler(ProviderUnavailable)
    def provider_error(exc):
        return error('provider_unavailable', 'The shopping assistant is unavailable. Please try again.', 503)

    @app.errorhandler(HTTPException)
    def http_error(exc):
        return error('invalid_request', 'The HTTP request could not be completed.', exc.code or 400)

    @app.errorhandler(Exception)
    def unexpected_error(exc):
        app.logger.error('A stateless assistant request failed (%s).', type(exc).__name__)
        return error('internal_error', 'The assistant could not complete the request.', 500)

    return app
