import pytest
from sqlalchemy import select, update
from concurrent.futures import ThreadPoolExecutor
from db.models import orders, products

def prepare(runtime, session, product='p1', quantity=1):
    runtime.cart.set_item(session, product, quantity)
    return runtime.orders.prepare(session, '123 Test Street')['confirmation_id']

def test_prepare_does_not_commit(runtime, session):
    prepare(runtime, session)
    assert runtime.orders.accounts.orders('alice') == []
    assert runtime.catalog.get('p1')['stock'] == 2

def test_order_confirmation_and_duplicate(runtime, session):
    token = prepare(runtime, session)
    result = runtime.orders.confirm(session, token)
    again = runtime.orders.confirm(session, token)
    assert again['id'] == result['order_id']
    assert runtime.catalog.get('p1')['stock'] == 1
    assert len(runtime.orders.accounts.orders('alice')) == 1

def test_wrong_confirmation_and_cross_customer(runtime, session):
    token = prepare(runtime, session)
    bob = runtime.sessions.get(runtime.sessions.create('bob'))
    with pytest.raises(ValueError):
        runtime.orders.confirm(bob, token)
    result = runtime.orders.confirm(session, token)
    assert runtime.orders.accounts.orders('bob', result['order_id']) == []
    with pytest.raises(ValueError):
        runtime.orders.prepare_cancel(bob, result['order_id'])

def test_changed_price_requires_new_confirmation(runtime, session):
    token = prepare(runtime, session)
    with runtime.engine.begin() as conn:
        conn.execute(update(products).where(products.c.id == 'p1').values(price_minor=14000))
    with pytest.raises(ValueError, match='changed'):
        runtime.orders.confirm(session, token)
    assert runtime.orders.accounts.orders('alice') == []

def test_cancel_restores_once(runtime, session):
    result = runtime.orders.confirm(session, prepare(runtime, session))
    token = runtime.orders.prepare_cancel(session, result['order_id'])['confirmation_id']
    runtime.orders.confirm(session, token)
    with pytest.raises(ValueError):
        runtime.orders.confirm(session, token)
    assert runtime.catalog.get('p1')['stock'] == 2

def test_dispatched_cannot_cancel(runtime, session):
    result = runtime.orders.confirm(session, prepare(runtime, session))
    with runtime.engine.begin() as conn:
        conn.execute(update(orders).values(status='dispatched'))
    with pytest.raises(ValueError):
        runtime.orders.prepare_cancel(session, result['order_id'])

def test_last_unit_concurrent(runtime, session):
    bob = runtime.sessions.get(runtime.sessions.create('bob'))
    a, b = prepare(runtime, session, 'p2'), prepare(runtime, bob, 'p2')
    def attempt(pair):
        try:
            runtime.orders.confirm(*pair)
            return True
        except ValueError:
            return False
    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(attempt, [(session, a), (bob, b)]))
    assert sum(results) == 1
    assert runtime.catalog.get('p2')['stock'] == 0

def test_partial_transaction_rolls_back(runtime, session, monkeypatch):
    runtime.cart.set_item(session, 'p1', 1)
    runtime.cart.set_item(session, 'p2', 1)
    token = runtime.orders.prepare(session, '123 Test Street')['confirmation_id']
    original = runtime.orders.summary
    def race(s, address):
        result = original(s, address)
        with runtime.engine.begin() as conn:
            conn.execute(update(products).where(products.c.id == 'p2').values(stock=0))
        return result
    monkeypatch.setattr(runtime.orders, 'summary', race)
    with pytest.raises(ValueError):
        runtime.orders.confirm(session, token)
    assert runtime.catalog.get('p1')['stock'] == 2
    assert runtime.orders.accounts.orders('alice') == []

def test_cart_change_invalidates_confirmation(runtime, session):
    token = prepare(runtime, session)
    runtime.cart.set_item(session, 'p1', 2)
    with pytest.raises(ValueError):
        runtime.orders.confirm(session, token)

def test_expired_confirmation(runtime, session):
    token = prepare(runtime, session)
    session.pending['expires'] = 0
    with pytest.raises(ValueError, match='expired'):
        runtime.orders.confirm(session, token)

@pytest.mark.parametrize('quantity', [-1, 1.2, True, 10001])
def test_invalid_quantity(runtime, session, quantity):
    with pytest.raises(ValueError):
        runtime.cart.set_item(session, 'p1', quantity)
