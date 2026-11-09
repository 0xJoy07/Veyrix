"""Never persist secrets in settings files."""
class CredentialStore:
    def __init__(self, profile='default'):
        self.service = 'shopping-agent/' + profile
        self.session = {}

    def set(self, name, value, persist=False):
        self.session[name] = value
        if persist:
            try:
                import keyring
                keyring.set_password(self.service, name, value)
            except Exception as exc:
                raise ValueError('Secure credential storage unavailable. Choose session-only storage.') from None

    def get(self, name):
        if name in self.session:
            return self.session[name]
        try:
            import keyring
            return keyring.get_password(self.service, name) or ''
        except Exception:
            return ''
