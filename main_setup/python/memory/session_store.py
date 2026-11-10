"""RAM-only sessions with per-session serialization for threaded HTTP workers."""
import time
import uuid
from contextlib import contextmanager
from dataclasses import dataclass, field
from threading import RLock, Event, Thread


class SessionNotFound(ValueError):
    """An expired, closed or unknown session must never be silently recreated."""


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
    def __init__(self, ttl=0):
        if ttl < 0:
            raise ValueError('Session timeout cannot be negative.')
        self.ttl, self.sessions = ttl, {}
        self.lock = RLock()
        self.stopped = Event()
        self.worker = None
        if ttl:
            self.worker = Thread(target=self._cleanup, daemon=True)
            self.worker.start()

    @staticmethod
    def _clear(session):
        session.history.clear()
        session.cart.clear()
        session.pending.clear()

    def _cleanup(self):
        while not self.stopped.wait(min(30, max(1, self.ttl))):
            self.sweep()

    def shutdown(self):
        self.stopped.set()
        with self.lock:
            ids = list(self.sessions)
        for sid in ids:
            self.close(sid)
        if self.worker is not None:
            self.worker.join()

    def create(self, customer_id):
        self.sweep()
        with self.lock:
            if self.stopped.is_set():
                raise ValueError('Session store is closed.')
            session = Session(customer_id)
            self.sessions[session.id] = session
            return session.id

    def sweep(self):
        if not self.ttl:
            return
        with self.lock:
            candidates = list(self.sessions.values())
        for session in candidates:
            # An in-flight request is not idle and must not block other sessions.
            if not session.lock.acquire(blocking=False):
                continue
            try:
                with self.lock:
                    if (self.sessions.get(session.id) is session
                            and time.monotonic() - session.touched >= self.ttl):
                        self.sessions.pop(session.id)
                        self._clear(session)
            finally:
                session.lock.release()

    @contextmanager
    def use(self, sid):
        """Lease a session for one complete operation; close/reset waits for it.

        Never hold the store lock while waiting for a session lock. Every path
        that needs both locks takes the session lock first, preventing inversion.
        """
        with self.lock:
            session = self.sessions.get(sid)
        if session is None:
            raise SessionNotFound('Session expired or not found. Start a new session.')
        with session.lock:
            with self.lock:
                if self.sessions.get(sid) is not session or self.stopped.is_set():
                    raise SessionNotFound('Session expired or not found. Start a new session.')
                if self.ttl and time.monotonic() - session.touched >= self.ttl:
                    self.sessions.pop(sid)
                    self._clear(session)
                    raise SessionNotFound('Session expired or not found. Start a new session.')
                session.touched = time.monotonic()
            try:
                yield session
            finally:
                session.touched = time.monotonic()

    def get(self, sid):
        # Compatibility for local services/tests; request handlers use use().
        with self.use(sid) as session:
            return session

    def close(self, sid):
        with self.lock:
            session = self.sessions.get(sid)
        if session is not None:
            with session.lock:
                with self.lock:
                    if self.sessions.get(sid) is session:
                        self.sessions.pop(sid)
                        self._clear(session)
