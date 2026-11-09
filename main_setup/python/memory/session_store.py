import time
import uuid
from dataclasses import dataclass, field
from threading import RLock, Event, Thread

@dataclass
class Session:
    customer_id: str
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    cart: dict = field(default_factory=dict)
    history: list = field(default_factory=list)
    pending: dict = field(default_factory=dict)
    touched: float = field(default_factory=time.monotonic)
    lock: object = field(default_factory=RLock)

class SessionStore:
    def __init__(self, ttl=1800):
        self.ttl, self.sessions = ttl, {}
        self.lock = RLock()
        self.stopped = Event()
        Thread(target=self._cleanup, daemon=True).start()

    def _cleanup(self):
        while not self.stopped.wait(min(30, max(1, self.ttl))):
            with self.lock:
                self.sweep()

    def shutdown(self):
        self.stopped.set()
        for sid in list(self.sessions):
            self.close(sid)

    def create(self, customer_id):
        with self.lock:
            self.sweep()
            session = Session(customer_id)
            self.sessions[session.id] = session
            return session.id

    def sweep(self):
        for sid, session in list(self.sessions.items()):
            if time.monotonic() - session.touched >= self.ttl:
                self.close(sid)

    def get(self, sid):
        with self.lock:
            self.sweep()
            if sid not in self.sessions:
                raise ValueError('Session expired. Start a new session.')
            session = self.sessions[sid]
            session.touched = time.monotonic()
            return session

    def close(self, sid):
        with self.lock:
            session = self.sessions.pop(sid, None)
            if session:
                with session.lock:
                    session.history.clear()
                    session.cart.clear()
                    session.pending.clear()
