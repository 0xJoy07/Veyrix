import time
import pytest
from memory.chat_memory import add_turn

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
    session.touched = time.monotonic() - 2000
    with pytest.raises(ValueError):
        runtime.sessions.get(session.id)

def test_bounded_history(session):
    for _ in range(30):
        add_turn(session, 'hello', 'hi')
    assert len(session.history) == 20
