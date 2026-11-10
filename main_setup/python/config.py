"""Non-secret backend configuration; environment.py supplies runtime settings."""
import json
import re
from dataclasses import dataclass, asdict, field
from pathlib import Path

DEFAULT_PATH = Path(__file__).parent / 'state' / 'config.json'

@dataclass
class Config:
    store_name: str = 'My Store'
    currency: str = 'INR'
    model: str = ''
    source: str = 'sqlite'
    database: str = str(Path(__file__).parent / 'state' / 'store.db')
    host: str = 'localhost'
    port: int = 5432
    username: str = ''
    sslmode: str = 'require'
    ssl_ca: str = ''
    product_table: str = 'products'
    database_schema: str = 'public'
    mapping: dict = field(default_factory=dict)
    delivery_minor: int = 0
    policy: str = 'Pay on delivery only. Cancellation allowed before dispatch.'
    session_seconds: int = 0
    profile: str = 'default'

    def validate(self):
        if not isinstance(self.database_schema, str) or not re.fullmatch(r'[a-z_][a-z0-9_]{0,62}', self.database_schema):
            raise ValueError('Schema must be a lowercase PostgreSQL identifier.')
        if self.source not in ('sqlite', 'postgresql', 'mysql'):
            raise ValueError('Choose SQLite, PostgreSQL, or MySQL.')
        if self.sslmode not in ('require', 'verify-full', 'disable'):
            raise ValueError('Invalid TLS mode.')
        if not isinstance(self.mapping, dict) or any(not isinstance(k, str) or not isinstance(v, str) for k, v in self.mapping.items()):
            raise ValueError('Mapping must be a JSON object of field names to column names.')
        if not self.store_name.strip() or not self.database.strip():
            raise ValueError('Store name and database are required.')
        if len(self.currency) != 3 or not self.currency.isalpha():
            raise ValueError('Currency must be a three-letter code.')
        if self.delivery_minor < 0:
            raise ValueError('Delivery charge must be nonnegative.')
        if (not isinstance(self.session_seconds, int) or isinstance(self.session_seconds, bool)
                or self.session_seconds < 0 or 0 < self.session_seconds < 60):
            raise ValueError('Session timeout must be 0 (until closed) or at least 60 seconds.')
        if self.source != 'sqlite' and (not self.host or not self.username or not 1 <= self.port <= 65535):
            raise ValueError('Server host, username, and valid port required.')
        return self

    def save(self, path=DEFAULT_PATH):
        self.validate()
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix('.tmp')
        temporary.write_text(json.dumps(asdict(self), indent=2), encoding='utf-8')
        temporary.replace(path)

    @classmethod
    def load(cls, path=DEFAULT_PATH):
        return cls(**json.loads(Path(path).read_text(encoding='utf-8'))).validate()
