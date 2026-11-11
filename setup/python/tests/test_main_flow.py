"""Headless orchestration, session memory, and threaded lifecycle regression tests."""
import subprocess
import sys
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from langchain_core.messages import AIMessage, HumanMessage

import main
from api import PreparedApplication


class RecordingModel:
    def __init__(self):
        self.messages = []
    def bind_tools(self, tools):
        return self
    def invoke(self, messages):
        self.messages.append(list(messages))
        return AIMessage(content='Remembered your request.')


def backend(runtime, model=None):
    return main.BackendApplication(PreparedApplication(runtime, {'status': 'ready'}), model=model or RecordingModel())


def test_new_and_existing_requests_share_history(runtime):
    model = RecordingModel()
    app = backend(runtime, model)
    first = app.chat('I prefer blue shoes', customer_id='alice')
    second = app.chat('What color did I prefer?', session_id=first['session_id'])
    assert second['session_id'] == first['session_id']
    assert any(isinstance(message, HumanMessage) and message.content == 'I prefer blue shoes' for message in model.messages[-1])
    assert len(runtime.sessions.get(first['session_id']).history) == 4


def test_unknown_session_is_not_recreated(runtime):
    app = backend(runtime)
    with pytest.raises(main.SessionNotFound):
        app.chat('hello', session_id='missing')
    assert not runtime.sessions.sessions


def test_identity_cannot_change_for_existing_session(runtime):
    app = backend(runtime)
    sid = app.start_session('alice')
    with pytest.raises(ValueError, match='identity'):
        app.chat('hello', session_id=sid, customer_id='bob')
    assert runtime.sessions.get(sid).customer_id == 'alice'
    assert not runtime.sessions.get(sid).history


@pytest.mark.parametrize('message', ['', None, 1, 'x' * 8001])
def test_invalid_message_never_allocates_session(runtime, message):
    app = backend(runtime)
    with pytest.raises(ValueError, match='message'):
        app.chat(message, customer_id='alice')
    assert not runtime.sessions.sessions


def test_provider_failure_is_typed_sanitized_and_cleans_new_session(runtime):
    class Broken(RecordingModel):
        def invoke(self, messages):
            raise RuntimeError('provider-secret-do-not-print')
    app = backend(runtime, Broken())
    with pytest.raises(main.ProviderUnavailable) as error:
        app.chat('hello', customer_id='alice')
    assert 'provider-secret' not in str(error.value)
    assert not runtime.sessions.sessions
    sid = app.start_session('alice')
    session = runtime.sessions.get(sid)
    session.history.append(('human', 'earlier preference'))
    with pytest.raises(main.ProviderUnavailable):
        app.chat('hello again', session_id=sid)
    assert session.history == [('human', 'earlier preference')]


def test_reset_close_and_shutdown_clear_memory(runtime):
    app = backend(runtime)
    first = app.chat('remember me', customer_id='alice')['session_id']
    old = runtime.sessions.get(first)
    new = app.reset_session(first)
    assert new != first and not old.history
    with pytest.raises(main.SessionNotFound):
        app.chat('hello', session_id=first)
    app.close_session(new)
    with pytest.raises(main.SessionNotFound):
        app.close_session(new)
    runtime.secrets.set('groq_api_key', 'temporary')
    app.start_session('bob')
    app.close()
    app.close()
    assert runtime.closed and not runtime.sessions.sessions and not runtime.secrets.session


def test_close_waits_for_inflight_chat_without_deadlock(runtime):
    entered, release, closing = threading.Event(), threading.Event(), threading.Event()
    class Blocking(RecordingModel):
        def invoke(self, messages):
            entered.set()
            assert release.wait(5)
            return super().invoke(messages)
    app = backend(runtime, Blocking())
    sid = app.start_session('alice')
    session = runtime.sessions.get(sid)
    def close():
        closing.set()
        app.close_session(sid)
    with ThreadPoolExecutor(max_workers=2) as pool:
        chatting = pool.submit(app.chat, 'hello', session_id=sid)
        assert entered.wait(2)
        closing_future = pool.submit(close)
        assert closing.wait(2)
        assert not closing_future.done()
        release.set()
        assert chatting.result(timeout=3)['session_id'] == sid
        closing_future.result(timeout=3)
    assert not session.history and not runtime.sessions.sessions


def test_two_requests_to_same_session_are_serialized(runtime):
    entered, release = threading.Event(), threading.Event()
    class Blocking(RecordingModel):
        def invoke(self, messages):
            if not self.messages:
                entered.set()
                assert release.wait(5)
            return super().invoke(messages)
    model = Blocking()
    app = backend(runtime, model)
    sid = app.start_session('alice')
    with ThreadPoolExecutor(max_workers=2) as pool:
        first = pool.submit(app.chat, 'first message', session_id=sid)
        assert entered.wait(2)
        second = pool.submit(app.chat, 'second message', session_id=sid)
        release.set()
        first.result(timeout=3)
        second.result(timeout=3)
    assert len(runtime.sessions.get(sid).history) == 4
    assert any(message.content == 'first message' for message in model.messages[1])


def test_main_default_delegates_to_server(monkeypatch):
    serve = Mock(return_value='running')
    monkeypatch.setitem(sys.modules, 'api.flask', SimpleNamespace(serve=serve))
    assert main.main(['--env-file', 'settings.env']) == 'running'
    serve.assert_called_once_with(env_path='settings.env')


def test_main_rejects_incomplete_report(runtime):
    with pytest.raises(ValueError, match='did not complete'):
        main.BackendApplication(PreparedApplication(runtime, {'status': 'failed'}))
    assert runtime.closed


def test_customer_registration_does_not_overwrite(runtime):
    from sqlalchemy import select
    from db.models import customers
    main.register_customer(runtime, 'new', 'New Customer')
    with pytest.raises(ValueError, match='already exists'):
        main.register_customer(runtime, 'new', 'Changed Name')
    with runtime.engine.connect() as conn:
        assert conn.execute(select(customers.c.name).where(customers.c.id == 'new')).scalar_one() == 'New Customer'


def test_failed_runtime_constructor_disposes_connection(monkeypatch):
    import runtime as module
    engine = Mock()
    monkeypatch.setattr(module, 'connect', Mock(return_value=engine))
    monkeypatch.setattr(module, 'Catalog', Mock(side_effect=ValueError('invalid catalog')))
    with pytest.raises(ValueError, match='invalid catalog'):
        module.Runtime(Mock(), Mock())
    engine.dispose.assert_called_once_with()


def test_main_imports_without_tkinter_installed():
    script = '''
import builtins
original = builtins.__import__
def checked(name, *args, **kwargs):
    if name == 'tkinter' or name.startswith('tkinter.'):
        raise AssertionError('Headless backend must not import Tkinter')
    return original(name, *args, **kwargs)
builtins.__import__ = checked
import main
'''
    result = subprocess.run([sys.executable, '-c', script], capture_output=True, text=True,
                            cwd=Path(__file__).resolve().parents[1], timeout=20)
    assert result.returncode == 0, result.stderr
