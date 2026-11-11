"""Optional terminal adapter for an already configured headless runtime."""
import json
from api import ShoppingAPI


def run(runtime, customer_id):
    api = ShoppingAPI(runtime)
    session_id = api.start_session(customer_id)
    print('Local prototype CLI. /confirm ID, /reset, /quit. Customer selection is for trusted local testing only.')
    try:
        while True:
            text = input('You: ').strip()
            if text == '/quit':
                break
            try:
                if text == '/reset':
                    session_id = api.reset_session(session_id)
                    print('Session reset.')
                elif text.startswith('/confirm '):
                    print(json.dumps(api.confirm(session_id, text.split(maxsplit=1)[1]), indent=2))
                else:
                    result = api.chat(session_id, text)
                    print('Agent:', result['answer'])
                    if result['pending']:
                        print('Pending action:', json.dumps(result['pending'], indent=2))
            except ValueError as exc:
                print(str(exc))
            except Exception:
                print('Operation failed. Check database availability; no success is assumed.')
    except (EOFError, KeyboardInterrupt):
        pass
    finally:
        api.close_session(session_id)
