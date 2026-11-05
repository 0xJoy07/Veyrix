import json
from sqlalchemy import select
from db.models import customers
from agent.agent import ShoppingAgent

def run(runtime, customer_id):
    if runtime.orders.can_write:
        with runtime.engine.connect() as conn:
            if not conn.execute(select(customers.c.id).where(customers.c.id == customer_id)).first():
                raise ValueError('Unknown demo customer. Run the customer command first.')
    session_id = runtime.sessions.create(customer_id)
    agent = ShoppingAgent(runtime)
    print('Local prototype CLI. /confirm ID, /reset, /quit. Customer selection is for trusted local testing only.')
    try:
        while True:
            text = input('You: ').strip()
            if text == '/quit':
                break
            try:
                if text == '/reset':
                    runtime.sessions.close(session_id)
                    session_id = runtime.sessions.create(customer_id)
                    print('Session reset.')
                elif text.startswith('/confirm '):
                    result = runtime.orders.confirm(runtime.sessions.get(session_id), text.split(maxsplit=1)[1])
                    print(json.dumps(result, indent=2))
                    from memory.chat_memory import add_turn
                    add_turn(runtime.sessions.get(session_id), text, 'Verified database result: ' + json.dumps(result))
                else:
                    print('Agent:', agent.chat(session_id, text))
                    pending = runtime.sessions.get(session_id).pending
                    if pending:
                        print('Pending action:', json.dumps(pending, default=str, indent=2))
            except ValueError as exc:
                print(str(exc))
            except Exception:
                print('Operation failed. Check database availability; no success is assumed.')
    except (EOFError, KeyboardInterrupt):
        pass
    finally:
        runtime.sessions.close(session_id)
