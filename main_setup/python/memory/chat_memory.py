def add_turn(session, user, assistant):
    session.history.extend([('human', user[:8000]), ('ai', assistant[:8000])])
    session.history[:] = session.history[-20:]
