"""Exercise real HTTP sockets, Flask, main.py and session memory together."""
import json
import threading
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from langchain_core.messages import AIMessage, HumanMessage
from waitress import create_server

from api import PreparedApplication
from api.flask import create_app
from main import BackendApplication


class MemoryModel:
    def bind_tools(self, tools):
        return self

    def invoke(self, messages):
        human = [m.content for m in messages if isinstance(m, HumanMessage)]
        if human[-1] == 'What color?':
            assert 'I prefer blue shoes' in human[:-1]
            return AIMessage(content='You prefer blue.')
        return AIMessage(content='Preference remembered.')


def test_real_http_new_session_history_auth_and_close(runtime):
    key = 'local-integration-token-with-at-least-32-characters'
    backend = BackendApplication(PreparedApplication(runtime, {'status': 'ready'}), model=MemoryModel())
    app = create_app(application=backend, api_key=key)
    server = create_server(app, host='127.0.0.1', port=0, threads=2,
                           asyncore_loop_timeout=.05, map={})
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    base = f'http://127.0.0.1:{server.effective_port}'

    def call(path, data=None, method=None, authenticated=True):
        headers = {'Connection': 'close'}
        if authenticated:
            headers['Authorization'] = 'Bearer ' + key
        encoded = None if data is None else json.dumps(data).encode('utf-8')
        if encoded is not None:
            headers['Content-Type'] = 'application/json'
        request = Request(base + path, data=encoded, headers=headers, method=method)
        try:
            response = urlopen(request, timeout=5)
        except HTTPError as error:
            response = error
        with response:
            return response.status, json.load(response)

    try:
        assert call('/health', authenticated=False) == (200, {'status': 'ok'})
        status, _ = call('/api/chat', {'customer_id': 'alice', 'message': 'hello'}, authenticated=False)
        assert status == 401
        status, first = call('/api/chat', {'customer_id': 'alice', 'message': 'I prefer blue shoes'})
        assert status == 200
        sid = first['session_id']
        status, followup = call('/api/chat', {'session_id': sid, 'message': 'What color?'})
        assert status == 200 and followup['answer'] == 'You prefer blue.'
        assert len(runtime.sessions.get(sid).history) == 4
        assert call(f'/api/sessions/{sid}', method='DELETE')[0] == 200
        assert call('/api/chat', {'session_id': sid, 'message': 'hello'})[0] == 404
    finally:
        server.task_dispatcher.shutdown()
        server.close()
        thread.join(timeout=3)
        app.extensions['shopping_shutdown']()
    assert not thread.is_alive()
    assert runtime.closed
