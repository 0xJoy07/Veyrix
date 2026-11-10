"""In-memory credentials supplied by the environment loader; no GUI or keyring."""

class CredentialStore:
    def __init__(self, profile='default'):
        self.profile = profile
        self.session = {}

    def set(self, name, value, persist=False):
        if persist:
            raise ValueError('Credential persistence is disabled. Configure credentials through environment variables or .env.')
        self.session[name] = value

    def get(self, name):
        return self.session.get(name, '')

    def clear_session(self):
        """Release process-held copies; the supplied environment remains unchanged."""
        self.session.clear()
