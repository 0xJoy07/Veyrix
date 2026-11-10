from db.connection import connect
from db.catalog_repository import Catalog
from services.cart_service import CartService
from services.order_service import OrderService
from memory.session_store import SessionStore

class Runtime:
    def __init__(self, config, secrets):
        self.config, self.secrets = config, secrets
        self.engine = connect(config, secrets)
        self.closed = False
        try:
            self.catalog = Catalog(self.engine, config)
            self.cart = CartService(self.catalog)
            self.orders = OrderService(self.engine, config, self.catalog)
            self.sessions = SessionStore(config.session_seconds)
        except BaseException:
            self.engine.dispose()
            raise

    def close(self):
        if self.closed:
            return
        self.closed = True
        try:
            self.sessions.shutdown()
        finally:
            self.engine.dispose()
            self.secrets.clear_session()
