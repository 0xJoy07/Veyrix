from sqlalchemy import select
from db.models import orders, order_items

class AccountRepository:
    def __init__(self, engine):
        self.engine = engine

    def orders(self, customer_id, order_id=None):
        query = select(orders).where(orders.c.customer_id == customer_id)
        if order_id:
            query = query.where(orders.c.id == order_id)
        with self.engine.connect() as conn:
            result = [dict(r) for r in conn.execute(query.order_by(orders.c.created_at.desc()).limit(50)).mappings()]
            for row in result:
                row['items'] = [dict(r) for r in conn.execute(select(order_items).where(order_items.c.order_id == row['id'])).mappings()]
        return result
