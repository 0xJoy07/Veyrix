class CartService:
    def __init__(self, catalog):
        self.catalog = catalog

    def set_item(self, session, product_id, quantity):
        if type(quantity) is not int or not 0 <= quantity <= 10000:
            raise ValueError('Quantity must be a whole number between 0 and 10000.')
        with session.lock:
            if quantity:
                product = self.catalog.get(product_id)
                if product['stock'] < quantity:
                    raise ValueError('Insufficient stock.')
                session.cart[product_id] = quantity
            else:
                session.cart.pop(product_id, None)
            session.pending.clear()
            return self.view(session)

    def view(self, session):
        return [dict(self.catalog.get(pid), quantity=quantity) for pid, quantity in session.cart.items()]
