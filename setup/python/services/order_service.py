import time
import uuid
from datetime import datetime, timezone
from sqlalchemy import select, update
from db.models import products, customers, orders, order_items, events
from db.db_setup import writable
from db.account_repository import AccountRepository

def uid():
    return str(uuid.uuid4())

def now():
    return datetime.now(timezone.utc).isoformat()

class OrderService:
    def __init__(self, engine, config, catalog):
        self.engine, self.config, self.catalog = engine, config, catalog
        self.can_write = writable(engine) and config.product_table == 'products' and not config.mapping
        self.accounts = AccountRepository(engine)

    def require_write(self):
        if not self.can_write:
            raise ValueError('Order operations require the application schema and canonical product mapping.')

    def summary(self, session, address):
        if not session.cart:
            raise ValueError('Cart is empty.')
        if not isinstance(address, str) or not 5 <= len(address.strip()) <= 1000:
            raise ValueError('Provide a delivery address between 5 and 1000 characters.')
        items = []
        for pid, quantity in sorted(session.cart.items()):
            product = self.catalog.get(pid)
            if product['stock'] < quantity:
                raise ValueError('Insufficient stock for ' + product['name'])
            items.append({k: product[k] for k in ('id', 'name', 'price_minor')} | {'quantity': quantity})
        return dict(items=items, address=address.strip(), currency=self.config.currency,
            delivery_minor=self.config.delivery_minor,
            total_minor=sum(i['price_minor'] * i['quantity'] for i in items) + self.config.delivery_minor,
            payment_method='pay_on_delivery')

    def prepare(self, session, address):
        self.require_write()
        with session.lock:
            summary = self.summary(session, address)
            token = uid()
            session.pending = dict(token=token, kind='order', summary=summary, expires=time.monotonic()+300)
            return dict(summary, confirmation_id=token, instruction='Review the order summary and use the confirmation button to place the order.')

    def prepare_cancel(self, session, order_id):
        self.require_write()
        matches = self.accounts.orders(session.customer_id, order_id)
        if not matches or matches[0]['status'] not in ('confirmed', 'preparing'):
            raise ValueError('Order unavailable or no longer eligible for cancellation.')
        token = uid()
        with session.lock:
            session.pending = dict(token=token, kind='cancel', order_id=order_id, expires=time.monotonic()+300)
        return {'order_id': order_id, 'confirmation_id': token, 'instruction': 'Review the cancellation summary and use the confirmation button to cancel.'}

    def confirm(self, session, token):
        """Trusted UI handler only. Never expose this function as an LLM tool."""
        self.require_write()
        with session.lock:
            with self.engine.connect() as conn:
                previous = conn.execute(select(orders).where(orders.c.request_id == token, orders.c.customer_id == session.customer_id)).mappings().first()
            if previous:
                return dict(previous)
            pending = session.pending
            if pending.get('token') != token or pending.get('expires', 0) < time.monotonic():
                raise ValueError('Confirmation is invalid or expired. Prepare the action again.')
            if pending['kind'] == 'cancel':
                result = self._cancel(session, pending['order_id'])
            else:
                summary = self.summary(session, pending['summary']['address'])
                if summary != pending['summary']:
                    session.pending.clear()
                    raise ValueError('Order details changed. Prepare and confirm a new summary.')
                result = self._place(session, token, summary)
                session.cart.clear()
            session.pending.clear()
            return result

    def _place(self, session, token, summary):
        order_id = uid()
        with self.engine.begin() as conn:
            if not conn.execute(select(customers.c.id).where(customers.c.id == session.customer_id)).first():
                raise ValueError('Customer identity is not registered.')
            for item in summary['items']:
                changed = conn.execute(update(products).where(products.c.id == item['id'],
                    products.c.stock >= item['quantity'], products.c.price_minor == item['price_minor'],
                    products.c.name == item['name']).values(stock=products.c.stock-item['quantity']))
                if changed.rowcount != 1:
                    raise ValueError('Stock or product details changed. Prepare a new order.')
            conn.execute(orders.insert().values(id=order_id, customer_id=session.customer_id, request_id=token,
                status='confirmed', total_minor=summary['total_minor'], currency=summary['currency'],
                address=summary['address'], created_at=now(), payment_method='pay_on_delivery'))
            for item in summary['items']:
                conn.execute(order_items.insert().values(id=uid(), order_id=order_id, product_id=item['id'],
                    name=item['name'], quantity=item['quantity'], price_minor=item['price_minor']))
            conn.execute(events.insert().values(id=uid(), order_id=order_id, event='confirmed', created_at=now()))
        return {'order_id': order_id, 'status': 'confirmed', 'total_minor': summary['total_minor'], 'payment_method': 'pay_on_delivery'}

    def _cancel(self, session, order_id):
        with self.engine.begin() as conn:
            changed = conn.execute(update(orders).where(orders.c.id == order_id, orders.c.customer_id == session.customer_id,
                orders.c.status.in_(['confirmed', 'preparing'])).values(status='cancelled'))
            if changed.rowcount != 1:
                raise ValueError('Order is no longer eligible for cancellation.')
            for item in conn.execute(select(order_items).where(order_items.c.order_id == order_id)).mappings():
                conn.execute(update(products).where(products.c.id == item['product_id']).values(stock=products.c.stock+item['quantity']))
            conn.execute(events.insert().values(id=uid(), order_id=order_id, event='cancelled', created_at=now()))
        return {'order_id': order_id, 'status': 'cancelled'}
