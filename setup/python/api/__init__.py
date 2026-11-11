"""Local application API, owned and injected by main.py."""
from .service import PreparedApplication, ShoppingAPI, prepare_application

__all__ = ['PreparedApplication', 'ShoppingAPI', 'prepare_application']
