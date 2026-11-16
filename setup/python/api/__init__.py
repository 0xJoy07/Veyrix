"""HTTP package; administrative exports are loaded only on explicit access."""
__all__ = ['PreparedApplication', 'prepare_application']


def __getattr__(name):
    if name in __all__:
        from . import service
        return getattr(service, name)
    raise AttributeError(name)
