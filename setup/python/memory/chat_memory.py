def add_turn(session, user, assistant):
    """Keep the complete transcript in RAM for the lifetime of this session."""
    with session.lock:
        session.history.extend([('human', user), ('ai', assistant)])
