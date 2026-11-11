"""HTTP contract using a real isolated runtime and deterministic model."""
import json
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from langchain_core.messages import AIMessage, HumanMessage

from api import PreparedApplication
from api.flask import create_app, MAX_BODY_BYTES
from main import BackendApplication, ProviderUnavailable


SERVER_KEY = 'test-server-key-' * 3
AUTH = {'Authorization': 'Bearer ' + SERVER_KEY}


class Model:
    def __init__(self):
        self.calls = []

    def bind_tools(self, tools):
        return self

    def invoke(self, messages):
        self.calls.append(list(messages))
        return AIMessage(content='I remember your preferences.')


@pytest.fixture
def http_backend(runtime):
    model = Model()
    application = BackendApplication(PreparedApplication(runtime, {'status': 'ready'}), model=model)
    app = create_app(application=application, api_key=SERVER_KEY)
    yield app, application, model
    app.extensions['shopping_shutdown']()


def test_new_then_existing_chat_uses_server_history(http_backend):
    app, backend, model = http_backend
    client = app.test_client()
    first = client.post('/api/chat', json={'customer_id': 'alice', 'message': 'I prefer blue shoes'}, headers=AUTH)
    assert first.status_code == 200
    sid = first.json['session_id']
    second = client.post('/api/chat', json={'session_id': sid, 'message': 'What color do I prefer?'}, headers=AUTH)
    assert second.status_code == 200 and second.json['session_id'] == sid
    assert any(isinstance(msg, HumanMessage) and msg.content == 'I prefer blue shoes' for msg in model.calls[-1])
    assert len(backend.runtime.sessions.get(sid).history) == 4
    assert second.headers['Cache-Control'] == 'no-store'
    assert 'Access-Control-Allow-Origin' not in second.headers
    assert not backend.closed  # Flask request teardown must not discard the runtime.


def test_sessions_reset_close_and_customer_isolation(http_backend):
    app, backend, model = http_backend
    client = app.test_client()
    alice = client.post('/api/sessions', json={'customer_id': 'alice'}, headers=AUTH)
    bob = client.post('/api/sessions', json={'customer_id': 'bob'}, headers=AUTH)
    assert alice.status_code == bob.status_code == 201
    sid = alice.json['session_id']
    bob_sid = bob.json['session_id']
    client.post('/api/chat', json={'session_id': sid, 'message': 'Private Alice preference'}, headers=AUTH)
    client.post('/api/chat', json={'session_id': bob_sid, 'message': 'Hello'}, headers=AUTH)
    assert not any('Private Alice preference' in str(msg.content) for msg in model.calls[-1])
    old = backend.runtime.sessions.get(sid)
    reset = client.post(f'/api/sessions/{sid}/reset', headers=AUTH)
    assert reset.status_code == 200 and reset.json['session_id'] != sid
    assert not old.history
    assert client.post('/api/chat', json={'session_id': sid, 'message': 'Hello'}, headers=AUTH).status_code == 404
    new_sid = reset.json['session_id']
    assert client.delete(f'/api/sessions/{new_sid}', headers=AUTH).status_code == 200
    assert client.delete(f'/api/sessions/{new_sid}', headers=AUTH).status_code == 404


def test_authentication_and_public_health(http_backend):
    app, backend, _ = http_backend
    client = app.test_client()
    assert client.get('/health').json == {'status': 'ok'}
    for headers in ({}, {'Authorization': 'Bearer wrong'}, {'Authorization': 'Basic ' + SERVER_KEY},
                    {'Authorization': 'Bearer ' + SERVER_KEY + 'extra'}):
        response = client.post('/api/chat', json={'customer_id': 'alice', 'message': 'Hello'}, headers=headers)
        assert response.status_code == 401
        assert response.headers['WWW-Authenticate'] == 'Bearer'
    assert not backend.runtime.sessions.sessions
    app.extensions['shopping_shutdown']()
    assert client.get('/health').status_code == 503


@pytest.mark.parametrize('payload', [
    [], None, {'message': 'hi'}, {'message': 4, 'customer_id': 'alice'},
    {'message': 'hi', 'customer_id': None}, {'message': '', 'customer_id': 'alice'},
    {'message': 'x' * 8001, 'customer_id': 'alice'},
    {'message': 'hi', 'session_id': None},
    {'message': 'hi', 'session_id': 'known', 'customer_id': 'bob'},
    {'message': 'hi', 'customer_id': 'alice', 'history': []},
    {'message': 'hi', 'customer_id': 'alice', 'data': {'stock': 100}},
])
def test_chat_rejects_invalid_or_client_owned_context(http_backend, payload):
    app, backend, model = http_backend
    response = app.test_client().post('/api/chat', data=json.dumps(payload), content_type='application/json', headers=AUTH)
    assert response.status_code == 400
    assert not backend.runtime.sessions.sessions and not model.calls


def test_http_errors_are_json_and_body_limit_is_enforced(http_backend):
    client = http_backend[0].test_client()
    assert client.post('/api/chat', data='hello', headers=AUTH).status_code == 415
    malformed = client.post('/api/chat', data='{', content_type='application/json', headers=AUTH)
    assert malformed.status_code == 400 and malformed.is_json
    oversized = client.post('/api/chat', data='x' * (MAX_BODY_BYTES + 1), content_type='application/json', headers=AUTH)
    assert oversized.status_code == 413 and oversized.is_json
    assert client.get('/missing').status_code == 404
    assert client.get('/api/chat', headers=AUTH).status_code == 405


def test_provider_failure_returns_503_without_leaking_secrets(http_backend):
    app, backend, model = http_backend
    model.invoke = Mock(side_effect=RuntimeError('private-provider-key-and-password'))
    response = app.test_client().post('/api/chat', json={'customer_id': 'alice', 'message': 'Hello'}, headers=AUTH)
    assert response.status_code == 503
    assert response.json['error']['code'] == 'provider_unavailable'
    assert 'private-provider' not in response.get_data(as_text=True)
    assert not backend.runtime.sessions.sessions  # Failed first requests cannot leak unreachable sessions.


def test_unexpected_and_validation_errors_are_sanitized(http_backend, monkeypatch, caplog):
    app, backend, _ = http_backend
    client = app.test_client()
    for exception, status in ((RuntimeError('private-db-password'), 500), (ValueError('private-db-password'), 400)):
        monkeypatch.setattr(backend, 'start_session', Mock(side_effect=exception))
        response = client.post('/api/sessions', json={'customer_id': 'alice'}, headers=AUTH)
        assert response.status_code == status
        assert 'private-db-password' not in response.get_data(as_text=True) + caplog.text


def test_explicit_order_confirmation_only(http_backend):
    app, backend, _ = http_backend
    client = app.test_client()
    sid = client.post('/api/sessions', json={'customer_id': 'alice'}, headers=AUTH).json['session_id']
    session = backend.runtime.sessions.get(sid)
    backend.runtime.cart.set_item(session, 'p1', 1)
    pending = backend.runtime.orders.prepare(session, '123 Test Street')
    invalid = client.post(f'/api/sessions/{sid}/confirm', json={'confirmation_id': 'wrong-token'}, headers=AUTH)
    assert invalid.status_code == 400
    result = client.post(f'/api/sessions/{sid}/confirm', json={'confirmation_id': pending['confirmation_id']}, headers=AUTH)
    assert result.status_code == 200 and result.json['status'] == 'confirmed'
    assert not session.pending


def test_factory_rejects_missing_key_before_runtime(monkeypatch, tmp_path):
    import main
    monkeypatch.delenv('SHOPPING_API_KEY', raising=False)
    monkeypatch.setattr(main, 'create_application', Mock(side_effect=AssertionError('Must not connect')))
    with pytest.raises(ValueError, match='SHOPPING_API_KEY'):
        create_app(env_path=tmp_path / '.env')
    main.create_application.assert_not_called()


def test_factory_rejects_short_or_whitespace_key():
    for key in ('short', 'x' * 32 + ' '):
        with pytest.raises(ValueError, match='SHOPPING_API_KEY'):
            create_app(application=Mock(), api_key=key)


def test_waitress_runner_uses_single_process_threads_and_closes(monkeypatch):
    from api import flask as adapter
    import environment
    import waitress
    monkeypatch.setattr(environment, 'load_env_file', Mock())
    monkeypatch.setenv('SHOPPING_HOST', '127.0.0.1')
    monkeypatch.setenv('SHOPPING_PORT', '8765')
    shutdown = Mock()
    app = SimpleNamespace(extensions={'shopping_shutdown': shutdown})
    factory = Mock(return_value=app)
    run = Mock()
    monkeypatch.setattr(adapter, 'create_app', factory)
    monkeypatch.setattr(waitress, 'serve', run)
    adapter.serve(env_path='test.env')
    factory.assert_called_once_with(env_path='test.env')
    from api.stateless import MAX_BODY_BYTES as STATELESS_MAX_BODY_BYTES
    run.assert_called_once_with(app, host='127.0.0.1', port=8765, threads=4, max_request_body_size=STATELESS_MAX_BODY_BYTES)
    shutdown.assert_called_once_with()


@pytest.mark.parametrize('entrypoint', [['-m', 'api.flask'], ['api/flask.py']])
def test_direct_and_module_entrypoints_do_not_shadow_flask(entrypoint):
    import os
    import subprocess
    import sys
    from pathlib import Path
    env = dict(os.environ, SHOPPING_API_KEY='short-key')
    result = subprocess.run([sys.executable, *entrypoint], env=env, capture_output=True, text=True,
                            cwd=Path(__file__).resolve().parents[1], timeout=20)
    assert result.returncode == 1
    assert 'at least 32 characters' in result.stderr
    assert 'ImportError' not in result.stderr and 'Traceback' not in result.stderr
    assert 'tkinter' not in result.stderr.lower()
