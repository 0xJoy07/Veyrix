import time
import pytest
from memory.chat_memory import add_turn
from memory.session_store import SessionStore

def test_isolation_and_reset(runtime, session):
    bob = runtime.sessions.get(runtime.sessions.create('bob'))
    session.cart['p1'] = 1
    add_turn(session, 'hello', 'hi')
    assert not bob.cart and not bob.history
    runtime.sessions.close(session.id)
    assert not session.cart and not session.history
    with pytest.raises(ValueError):
        runtime.sessions.get(session.id)

def test_expiry(runtime, session):
    runtime.sessions.ttl = 1800
    session.touched = time.monotonic() - 2000
    with pytest.raises(ValueError):
        runtime.sessions.get(session.id)

def test_full_session_history(session):
    for index in range(30):
        add_turn(session, f'hello {index}', f'hi {index}')
    assert len(session.history) == 60
    assert session.history[0] == ('human', 'hello 0')
    assert session.history[-1] == ('ai', 'hi 29')


def test_default_session_does_not_expire(runtime, session):
    assert runtime.config.session_seconds == 0
    session.cart['p1'] = 1
    session.pending['request'] = 'pending'
    add_turn(session, 'remember this', 'remembered')
    session.touched = time.monotonic() - 86400 * 30
    runtime.sessions.sweep()
    assert runtime.sessions.get(session.id) is session
    assert session.history[0] == ('human', 'remember this')
    assert session.cart == {'p1': 1}
    assert session.pending == {'request': 'pending'}


def test_shutdown_erases_all_sessions_and_stops_cleanup():
    store = SessionStore(ttl=60)
    session = store.get(store.create('alice'))
    session.cart['p1'] = 1
    session.pending['request'] = 'pending'
    add_turn(session, 'hello', 'hi')
    store.shutdown()
    store.shutdown()
    assert not store.sessions
    assert not session.history and not session.cart and not session.pending
    assert not store.worker.is_alive()
    with pytest.raises(ValueError, match='closed'):
        store.create('bob')


def test_explicit_expiry_clears_transient_data():
    store = SessionStore(ttl=60)
    try:
        session = store.get(store.create('alice'))
        session.cart['p1'] = 1
        session.pending['request'] = 'pending'
        add_turn(session, 'hello', 'hi')
        session.touched = time.monotonic() - 61
        with pytest.raises(ValueError, match='expired'):
            store.get(session.id)
        assert not session.history and not session.cart and not session.pending
    finally:
        store.shutdown()


def test_idle_sweep_skips_inflight_session():
    import threading
    from concurrent.futures import ThreadPoolExecutor
    store = SessionStore(ttl=60)
    sid = store.create('alice')
    entered, release = threading.Event(), threading.Event()
    def active():
        with store.use(sid) as session:
            session.touched = time.monotonic() - 120
            entered.set()
            assert release.wait(3)
            session.history.append(('human', 'still active'))
    try:
        with ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(active)
            assert entered.wait(2)
            store.sweep()
            # A slow active provider request is not treated as an idle session.
            assert sid in store.sessions
            other = store.create('bob')
            assert other != sid
            release.set()
            future.result(timeout=2)
        assert store.get(sid).history == [('human', 'still active')]
    finally:
        release.set()
        store.shutdown()
