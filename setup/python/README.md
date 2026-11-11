# Veyrix stateless shopping assistant

The Python process is now a private, stateless Groq worker. The TypeScript service
in `../node` owns customer authentication, email verification, chats, carts,
addresses, orders, cancellations and all persistence through Prisma/Supabase.
The running Python server does not create a local database, transcript, customer
cache or in-memory session store. Request context exists only while processing
a request. No OTP or API key belongs in model messages.

## Start

Use Python 3.12. From `setup/python`:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
.\.venv\Scripts\python.exe main.py
```

Set these server-only environment values:

| Setting | Purpose |
| --- | --- |
| `SHOPPING_API_KEY` | At least 32 characters; same value as the Node service uses to call Python |
| `INTERNAL_API_KEY` | At least 32 characters; same private tool-service key as Node |
| `COMMERCE_API_URL` | Node service URL; defaults to `http://127.0.0.1:8001` |
| `GROQ_API_KEY` | Groq API credential |
| `GROQ_MODEL` | Tool-capable Groq model ID |
| `SHOPPING_HOST` | Listen host; defaults to `127.0.0.1` |
| `SHOPPING_PORT` | Listen port; defaults to `8000` |

Environment variables override the optional `.env` file. Do not expose either
server key through browser environment variables. The Node service and Supabase
schema must be configured separately; see [Node setup](../node/README.md).

`python -m api.flask` and `python api/flask.py` are equivalent startup commands.
The worker uses Waitress, without a Flask debugger or reloader.

## Private HTTP contract

`GET /health` returns `{ "status": "ok", "mode": "stateless" }`. This reports the
worker is configured and running, not that Groq and every downstream service are
currently reachable.

`POST /api/respond` requires `Authorization: Bearer <SHOPPING_API_KEY>`:

```json
{
  "chat_id": "verified-chat-id",
  "customer_id": "verified-customer-id",
  "turn_id": "active-node-turn-lease-id",
  "message": "Show me walking shoes",
  "history": [
    {"role": "user", "content": "I prefer blue shoes"},
    {"role": "assistant", "content": "I can help find those."}
  ]
}
```

The authenticated Node service supplies verified IDs and persisted history.
The frontend must never call this private route or choose the customer identity.
Response: `{ "answer": "..." }`, with `"action": "checkout"` when the assistant
opens the interactive address form. Node reads the pending confirmation state
from Supabase and includes it in its own frontend response.

Shopping tools call `POST /internal/tools` on Node, authenticated with
`INTERNAL_API_KEY`. Their identity is taken from the request's verified context,
never from model-generated arguments. Every tool request includes the active
`turn_id`; Node rejects expired or released turn leases to prevent late mutations. There is no model tool for committing an
order or cancellation. The frontend confirmation endpoint remains responsible.

The assistant classifies relevance before invoking shopping tools and redirects
unrelated requests, including standalone general knowledge or programming tasks.
It uses live tools for product facts and never asks customers to paste terminal
commands. Checkout uses saved-address selection or a form requiring recipient,
Indian mobile number, address, landmark, city, state and PIN code. Cancellation
eligibility and ownership are enforced in Node, not delegated to the model.

## Tests

From the repository root:

```powershell
.\setup\python\.venv\Scripts\python.exe -m pytest setup/python/tests -q
```

The stateless worker tests use mocked model and commerce calls. The legacy
SQLAlchemy/admin modules remain for isolated compatibility tests and explicit
administrative import utilities; they are not loaded as a runtime store by the
new HTTP startup. Do not run legacy `init-db`, imports or customer-registration
commands for the new Supabase service. No existing local data is automatically
deleted or migrated.
