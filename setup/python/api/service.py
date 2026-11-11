"""Credential-aware startup and a single interface for local clients.

This is an in-process API. Customer IDs are trusted local administrator inputs,
not authentication for a public HTTP service.
"""
import copy
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import InvalidOperation
from threading import Lock

from sqlalchemy import inspect, select, text

from agent.agent import ShoppingAgent, ProviderUnavailable
from agent.llm_client import make_model
from db.importers.files import integer
from db.models import customers, reviews
from memory.chat_memory import add_turn
from runtime import Runtime
from services.errors import describe_error


FETCH_BATCH_SIZE = 500
MAX_FETCH_RECORDS = 100_000


@dataclass
class PreparedApplication:
    runtime: Runtime
    report: dict
    _closed: bool = field(default=False, init=False, repr=False)

    def close(self):
        if not self._closed:
            self._closed = True
            self.runtime.close()


def _rows(connection, statement):
    """Read every record in bounded driver batches; never silently truncate."""
    result = connection.execution_options(stream_results=True).execute(statement).mappings()
    count = 0
    try:
        while True:
            batch = result.fetchmany(FETCH_BATCH_SIZE)
            if not batch:
                return
            count += len(batch)
            if count > MAX_FETCH_RECORDS:
                raise ValueError('The source exceeds the 100,000-record startup limit. Select a smaller catalog before continuing.')
            yield from batch
    finally:
        result.close()


def _product(catalog, row):
    try:
        if row[catalog.mapping['id']] is None:
            raise ValueError()
        value = catalog.normalize(row)
        if not value['id'].strip() or value['name'] is None or not str(value['name']).strip():
            raise ValueError()
        return dict(id=value['id'], name=str(value['name']),
                    price_minor=integer(value['price_minor']), stock=integer(value['stock']),
                    description=str(value.get('description') or ''),
                    category=str(value.get('category') or ''), currency=catalog.config.currency)
    except (KeyError, TypeError, ValueError, InvalidOperation):
        raise ValueError('A product cannot be formatted. Check IDs, names, integer stock and nonnegative prices in the selected mapping.') from None


def _fetch_catalog(runtime, emit):
    products, seen = [], set()
    with runtime.engine.connect() as conn:
        statement = select(runtime.catalog.table).order_by(runtime.catalog.table.c[runtime.catalog.mapping['id']])
        for row in _rows(conn, statement):
            product = _product(runtime.catalog, row)
            if product['id'] in seen:
                raise ValueError('Duplicate product IDs were found. Select a mapping with unique IDs.')
            seen.add(product['id'])
            products.append(product)
            if len(products) % FETCH_BATCH_SIZE == 0:
                emit('products', 'running', f'Fetched and formatted {len(products)} products.')
    return products


def _fetch_reviews(runtime, product_ids):
    inspector = inspect(runtime.engine)
    if not inspector.has_table('reviews'):
        return [], False, 'No reviews table is available.'
    if not set(reviews.c.keys()) <= {column['name'] for column in inspector.get_columns('reviews')}:
        return [], False, 'The reviews table does not use the supported review format.'
    # A different product table may have overlapping IDs with unrelated reviews.
    if runtime.config.product_table != 'products' or runtime.config.mapping:
        return [], False, 'Review fetching requires the standard product table and mapping.'
    records = []
    with runtime.engine.connect() as conn:
        for row in _rows(conn, select(reviews).order_by(reviews.c.id)):
            try:
                rating = integer(row['rating'])
                if not 1 <= rating <= 5 or row['id'] is None or row['text'] is None:
                    raise ValueError()
                if str(row['product_id']) not in product_ids:
                    raise ValueError()
                records.append(dict(id=str(row['id']), product_id=str(row['product_id']),
                                    rating=rating, text=str(row['text'])))
            except (TypeError, ValueError, InvalidOperation):
                raise ValueError('A review cannot be formatted. Check its ID, product reference, text and rating from 1 to 5.') from None
    return records, True, ''


def prepare_application(config, secrets, progress_callback=None, *, verify_groq=True):
    """Return a ready runtime only after database fetch and provider validation.

    Credentials remain in the supplied store; they are never copied to reports.
    verify_groq=False supports administrator customer registration without a model.
    """
    runtime = None
    current_step = 'settings'

    def emit(step, status, message):
        nonlocal current_step
        current_step = step
        if progress_callback:
            progress_callback(dict(step=step, status=status, message=message))

    try:
        emit('settings', 'running', 'Validating settings and required credentials.')
        config.validate()
        if config.source != 'sqlite' and not secrets.get('database_password'):
            raise ValueError('Set SHOPPING_DB_PASSWORD in the environment or .env file.')
        if verify_groq and (not config.model.strip() or not secrets.get('groq_api_key')):
            raise ValueError('Set a Groq model ID and API key with GROQ_MODEL and GROQ_API_KEY in the environment or .env file.')
        emit('settings', 'completed', 'Settings and required credentials are present.')
        emit('database', 'running', 'Connecting to the database and checking its schema.')
        runtime = Runtime(config, secrets)
        with runtime.engine.connect() as conn:
            conn.execute(text('SELECT 1'))
        emit('database', 'completed', 'Database connection and product mapping checked.')
        emit('products', 'running', 'Fetching and formatting all products.')
        products = _fetch_catalog(runtime, emit)
        emit('products', 'completed', f'Fetched and formatted {len(products)} products.')
        emit('reviews', 'running', 'Checking and fetching reviews.')
        review_rows, reviews_available, review_note = _fetch_reviews(runtime, {p['id'] for p in products})
        emit('reviews', 'completed', f'Fetched {len(review_rows)} reviews.' if reviews_available else review_note)
        if verify_groq:
            emit('groq', 'running', 'Checking the Groq API key and model connection.')
            try:
                make_model(config, secrets).invoke('Reply with OK.')
            except Exception:
                raise ValueError('Groq validation failed. Check the API key, model ID and internet connection, then retry.') from None
            emit('groq', 'completed', 'Groq responded successfully.')
        else:
            emit('groq', 'skipped', 'Groq is not required for customer registration.')
        report = dict(schema_version=1, status='ready', store_name=config.store_name,
                      currency=config.currency, fetched_at=datetime.now(timezone.utc).isoformat(),
                      checkout_enabled=runtime.orders.can_write, products=products, reviews=review_rows,
                      reviews_available=reviews_available, reviews_note=review_note,
                      counts=dict(products=len(products), reviews=len(review_rows)),
                      checks=dict(database=True, product_mapping=True, groq=verify_groq))
        # The handoff contract is plain JSON, including strict rejection of NaN.
        json.dumps(report, allow_nan=False)
        emit('ready', 'completed', 'All required checks completed. Ready to continue in main.py.')
        return PreparedApplication(runtime, report)
    except Exception as exc:
        if runtime is not None:
            runtime.close()
        message = str(exc) if isinstance(exc, ValueError) else describe_error(exc)
        emit(current_step, 'failed', message)
        raise ValueError(message) from None


class ShoppingAPI:
    """Session and chat operations for trusted local clients."""
    def __init__(self, runtime, model=None):
        self.runtime = runtime
        self.model = model
        self._agent = None
        self._agent_lock = Lock()

    def start_session(self, customer_id):
        if not isinstance(customer_id, str) or not customer_id.strip() or len(customer_id) > 100:
            raise ValueError('Provide a customer ID between 1 and 100 characters.')
        if self.runtime.orders.can_write:
            with self.runtime.engine.connect() as conn:
                exists = conn.execute(select(customers.c.id).where(customers.c.id == customer_id)).first()
            if not exists:
                raise ValueError('Unknown demo customer. Register this customer before starting chat.')
        return self.runtime.sessions.create(customer_id)

    def chat(self, session_id, text, *, raise_provider_errors=False):
        with self.runtime.sessions.use(session_id) as session:
            with self._agent_lock:
                if self._agent is None:
                    try:
                        self._agent = ShoppingAgent(self.runtime, self.model)
                    except Exception:
                        if raise_provider_errors:
                            raise ProviderUnavailable('The chat provider is unavailable. Try again later.') from None
                        raise
            answer = self._agent.chat(session_id, text, raise_provider_errors=raise_provider_errors)
            return dict(session_id=session_id, answer=answer, pending=copy.deepcopy(session.pending))

    def confirm(self, session_id, token):
        with self.runtime.sessions.use(session_id) as session:
            result = self.runtime.orders.confirm(session, token)
            add_turn(session, '/confirm ' + token, 'Verified database result: ' + json.dumps(result))
            return result

    def reset_session(self, session_id):
        with self.runtime.sessions.use(session_id) as session:
            customer_id = session.customer_id
            new_id = self.start_session(customer_id)
            self.runtime.sessions.close(session_id)
            return new_id

    def close_session(self, session_id):
        self.runtime.sessions.close(session_id)
