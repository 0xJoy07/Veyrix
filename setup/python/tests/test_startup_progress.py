from types import SimpleNamespace
from unittest.mock import Mock
import main
from api.flask import create_app, startup_progress


def test_progress_reaches_preparation(runtime, monkeypatch):
    callback = Mock()
    prepared = SimpleNamespace(runtime=runtime, report={'status': 'ready'}, close=Mock())
    prepare = Mock(return_value=prepared)
    monkeypatch.setattr(main, 'prepare_application', prepare)
    application = main.create_application(config=runtime.config, secrets=runtime.secrets,
                                          verify_groq=False, progress_callback=callback)
    prepare.assert_called_once_with(runtime.config, runtime.secrets, progress_callback=callback, verify_groq=False)
    application.close()


def test_http_factory_selects_stateless_worker(runtime, monkeypatch):
    import api.stateless
    callback = Mock()
    application = SimpleNamespace(runtime=runtime, report={'status': 'ready'}, close=Mock())
    factory = Mock(return_value=application)
    monkeypatch.setattr(api.stateless, 'create_stateless_app', factory)
    monkeypatch.setattr('environment.load_env_file', Mock())
    app = create_app(api_key='x' * 32, env_path='test.env', progress_callback=callback)
    factory.assert_called_once_with(api_key='x' * 32, env_path='test.env')
    assert app is application


def test_progress_output_omits_untrusted_details(capsys):
    startup_progress({'step': 'groq', 'status': 'running', 'message': 'private-api-key', 'data': 'private-password'})
    startup_progress({'step': 'private-api-key', 'status': 'private-password'})
    assert capsys.readouterr().out == '[startup] Checking Groq connection: running\n'
