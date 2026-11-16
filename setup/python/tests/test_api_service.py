import json
from types import SimpleNamespace

import pytest
from langchain_core.messages import AIMessage, HumanMessage
from sqlalchemy import MetaData, Table, Column, Integer, String, Numeric

from api import prepare_application
from api import service
from db.models import products, reviews


def configure_model(runtime, monkeypatch):
    runtime.config.model = 'test-model'
    runtime.secrets.set('groq_api_key', 'private-test-key')
    monkeypatch.setattr(service, 'make_model', lambda config, secrets: SimpleNamespace(invoke=lambda text: AIMessage(content='OK')))


def test_prepare_fetches_full_catalog_and_reports_progress(runtime, monkeypatch):
    configure_model(runtime, monkeypatch)
    monkeypatch.setattr(service, 'FETCH_BATCH_SIZE', 10)
    with runtime.engine.begin() as conn:
        conn.execute(products.insert(), [dict(id=f'p{i}', name=f'Product {i}', price_minor=i * 100,
                                           stock=i, description='', category='') for i in range(3, 54)])
        conn.execute(reviews.insert(), [dict(id=f'r{i}', product_id='p1', rating=5, text='Good') for i in range(105)])
    events = []
    prepared = prepare_application(runtime.config, runtime.secrets, events.append)
    try:
        report = prepared.report
        assert report['counts'] == {'products': 53, 'reviews': 105}
        assert report['status'] == 'ready' and report['checkout_enabled']
        assert report['checks'] == {'database': True, 'product_mapping': True, 'groq': True}
        assert report['reviews_available']
        assert all(isinstance(p['price_minor'], int) and isinstance(p['stock'], int) for p in report['products'])
        output = json.dumps(report) + json.dumps(events)
        assert 'private-test-key' not in output
        assert 'database_password' not in output
        assert events[-1]['step'] == 'ready' and events[-1]['status'] == 'completed'
        assert any(event['message'] == 'Fetched and formatted 50 products.' for event in events)
        assert [e['step'] for e in events if e['status'] == 'completed'] == ['settings', 'database', 'products', 'reviews', 'groq', 'ready']
        assert prepared.runtime.secrets is runtime.secrets
    finally:
        prepared.close()
        prepared.close()
    assert prepared.runtime.closed


def test_provider_failure_closes_runtime_and_redacts_provider_error(runtime, monkeypatch):
    configure_model(runtime, monkeypatch)
    created = []
    real_runtime = service.Runtime

    def create(*args):
        instance = real_runtime(*args)
        created.append(instance)
        return instance

    def failure(text):
        raise RuntimeError('private-test-key rejected by provider')

    monkeypatch.setattr(service, 'Runtime', create)
    monkeypatch.setattr(service, 'make_model', lambda *args: SimpleNamespace(invoke=failure))
    events = []
    with pytest.raises(ValueError, match='Groq validation failed') as error:
        prepare_application(runtime.config, runtime.secrets, events.append)
    assert 'private-test-key' not in str(error.value) + json.dumps(events)
    assert created[0].closed
    assert events[-1]['status'] == 'failed' and events[-1]['step'] == 'groq'
    assert not any(event['step'] == 'ready' for event in events)


def test_missing_credentials_fail_before_connect(runtime, monkeypatch):
    runtime.secrets.set('groq_api_key', '')
    monkeypatch.setattr(service, 'Runtime', lambda *args: pytest.fail('Must not connect'))
    with pytest.raises(ValueError, match='Groq model ID and API key'):
        prepare_application(runtime.config, runtime.secrets)


def test_customer_preparation_skips_groq(runtime, monkeypatch):
    monkeypatch.setattr(service, 'make_model', lambda *args: pytest.fail('Must not call Groq'))
    prepared = prepare_application(runtime.config, runtime.secrets, verify_groq=False)
    try:
        assert prepared.report['checks']['groq'] is False
        assert prepared.report['status'] == 'ready'
    finally:
        prepared.close()


def test_mapped_catalog_normalizes_prices_and_marks_reviews_unavailable(runtime):
    metadata = MetaData()
    table = Table('external_catalog', metadata, Column('sku', Integer, primary_key=True),
                  Column('title', String), Column('price', Numeric(10, 2)), Column('qty', Integer))
    metadata.create_all(runtime.engine)
    with runtime.engine.begin() as conn:
        conn.execute(table.insert(), dict(sku=42, title='Mapped item', price='12.50', qty=3))
    runtime.config.product_table = table.name
    runtime.config.mapping = {'id': 'sku', 'name': 'title', 'price': 'price', 'stock': 'qty'}
    prepared = prepare_application(runtime.config, runtime.secrets, verify_groq=False)
    try:
        assert prepared.report['products'] == [dict(id='42', name='Mapped item', price_minor=1250,
                                                  stock=3, currency='INR', description='', category='')]
        assert prepared.report['reviews_available'] is False
        assert prepared.report['checkout_enabled'] is False
        assert prepared.report['reviews_note']
        json.dumps(prepared.report)
    finally:
        prepared.close()


def test_fetch_limit_fails_instead_of_silently_truncating(runtime, monkeypatch):
    monkeypatch.setattr(service, 'MAX_FETCH_RECORDS', 1)
    events = []
    with pytest.raises(ValueError, match='startup limit'):
        prepare_application(runtime.config, runtime.secrets, events.append, verify_groq=False)
    assert events[-1]['status'] == 'failed'
    assert not any(event['step'] == 'ready' for event in events)
