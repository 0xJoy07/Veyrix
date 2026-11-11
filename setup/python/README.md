# Shopping Agent Python Backend

A headless Flask backend for shopping conversations, powered by LangChain and
Groq. `api/flask.py` receives HTTP requests, checks sessions, and calls the
application in `main.py`. The application owns database-backed shopping tools,
conversation history, carts and confirmed pay-on-delivery orders.

There is no desktop interface or chat frontend in this backend. Credentials come
from process environment variables or the optional `.env` file.

## Install and configure

Use Python 3.12. From `main_setup/python`:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Edit `.env` with your own values before starting the server:

| Setting | Purpose |
| --- | --- |
| `GROQ_API_KEY` | Groq API credential |
| `GROQ_MODEL` | Tool-capable model ID available to your Groq account |
| `SHOPPING_API_KEY` | Strong random server bearer token, at least 32 characters without whitespace |
| `SHOPPING_DB_SOURCE` | `sqlite`, `postgresql`, or `mysql` |
| `SHOPPING_DB_DATABASE` | SQLite file path or database name |
| `SHOPPING_DB_HOST`, `SHOPPING_DB_PORT` | Database server location |
| `SHOPPING_DB_USERNAME`, `SHOPPING_DB_PASSWORD` | Database credentials; not needed for SQLite |
| `SHOPPING_DB_SCHEMA` | Existing PostgreSQL schema; defaults to `public` |
| `SHOPPING_DB_SSLMODE`, `SHOPPING_DB_SSL_CA` | Database TLS mode and optional CA file |
| `SHOPPING_PRODUCT_TABLE`, `SHOPPING_PRODUCT_MAPPING` | Catalog table and optional field mapping JSON |
| `SHOPPING_SESSION_SECONDS` | `0` retains sessions until explicitly closed/reset or the process stops; positive values must be at least 60 |
| `SHOPPING_HOST`, `SHOPPING_PORT` | HTTP listener; defaults to `127.0.0.1:8000` |

`.env.example` also documents store name, currency, policy and delivery charge.
`SHOPPING_MODEL` is an optional override for `GROQ_MODEL`.

The loader reads only `.env` beside the Python project, regardless of the working
directory. Process environment variables take priority. To select another file,
put `--env-file PATH` before the command, for example `main.py --env-file
D:/config/shopping.env check`. Relative SQLite and CA paths resolve beside the
selected environment file. Quote passwords containing spaces or `#`; values
are literal, so `${...}` inside a password is not expanded.

A `.env` file contains plaintext secrets and is ignored by Git. Production hosts
can inject environment variables without creating a file. The server does not
read credentials from the OS keyring or legacy `state/config.json`, and does not
write credentials to reports. `requirements-lock.txt` records the dependency
versions for reproducing the installed environment.

## Prepare a local demo

For a new SQLite demo, retain `SHOPPING_DB_SOURCE=sqlite` and choose a new file
through `SHOPPING_DB_DATABASE`, then run:

```powershell
.\.venv\Scripts\python.exe main.py init-db
.\.venv\Scripts\python.exe main.py import examples/products.csv
.\.venv\Scripts\python.exe main.py import examples/reviews.csv --kind reviews
.\.venv\Scripts\python.exe main.py customer --id demo --name "Demo Customer"
.\.venv\Scripts\python.exe main.py check
```

Initialization creates the application schema only in an empty database/schema;
it rejects existing tables. Imports validate all records and reject existing IDs
without overwriting stock. Customer registration is an explicit administrative
command and never changes an existing customer. `init-db`, `import` and
`customer` do not require a Groq request. `check` validates the database, fetched
catalog and Groq connection, then prints a summary with no credentials or product
records.

For an existing database, configure its connection and mapping, skip initialization,
and use `check`. Do not import example data into an existing business catalog
unless that is intended.

## Start the backend

```powershell
.\.venv\Scripts\python.exe main.py
```

These equivalent entry points also start the server:

```powershell
.\.venv\Scripts\python.exe main.py serve
.\.venv\Scripts\python.exe -m api.flask
.\.venv\Scripts\python.exe api/flask.py
```

The runner uses Waitress with four threads in one process. It validates required
credentials, connects to the database, fetches catalog/review data and checks
Groq before accepting requests. The Flask debugger and reloader are disabled.
`GET /health` returns a minimal readiness result; it does not recheck every
external dependency on every request.

The WSGI factory is `api.flask:create_app`. For example, from the Python directory:

```powershell
.\.venv\Scripts\waitress-serve.exe --call --listen=127.0.0.1:8000 api.flask:create_app
```

The explicit WSGI command's listener options take precedence over the custom
runner's `SHOPPING_HOST`/`SHOPPING_PORT` settings. Deploy behind an HTTPS reverse
proxy when reachable outside a trusted local network. Keep one process while
sessions live in memory; multiple processes require a shared session store.

## API contract

All `/api/*` requests require:

```text
Authorization: Bearer <SHOPPING_API_KEY>
Content-Type: application/json
```

The bearer key authenticates a trusted upstream server. That server must verify
the end user's identity before selecting `customer_id` and must track which
session belongs to that user. The key is not end-user authentication and must not
be embedded in a public browser frontend. Cross-origin browser access is not
configured.

| Method | Route | Request / result |
| --- | --- | --- |
| `GET` | `/health` | No bearer key required; `{"status":"ok"}` or 503 |
| `POST` | `/api/chat` | First message: `customer_id` and `message`; later messages: `session_id` and `message` |
| `POST` | `/api/sessions` | `{"customer_id":"demo"}`; returns a new `session_id`, status 201 |
| `DELETE` | `/api/sessions/<session_id>` | Empty body; closes the session and clears its history/cart/pending action |
| `POST` | `/api/sessions/<session_id>/reset` | Empty body or `{}`; clears the old session and returns a new `session_id` |
| `POST` | `/api/sessions/<session_id>/confirm` | `{"confirmation_id":"..."}`; explicitly commits a prepared order/cancellation |

First message:

```json
{"customer_id":"demo","message":"I prefer blue walking shoes. What do you have?"}
```

A successful `/api/chat` response has this shape:

```json
{"session_id":"<generated-id>","answer":"<assistant response>","pending":{}}
```

Continue with the returned ID:

```json
{"session_id":"<generated-id>","message":"What color did I say I prefer?"}
```

Flask passes the request to `main.BackendApplication`. A first request creates a
session for the registered customer; subsequent requests retrieve that session
and its server-owned history. The agent uses the runtime's database-backed tools
for current products, reviews, prices and stock. Requests cannot supply history,
product data or credentials. Existing-session requests also cannot replace the
customer ID. Unknown fields are rejected; missing/expired session IDs are never
silently replaced with a new conversation.

Messages must be nonblank strings of at most 8,000 characters. Request bodies are
limited to 64 KiB. JSON arrays, malformed JSON and incorrect content types are
rejected. Error responses use:

```json
{"error":{"code":"session_not_found","message":"Session was not found or has expired. Start a new session."}}
```

| Status | Meaning |
| --- | --- |
| 400 | Invalid fields, unknown customer, invalid confirmation or unsupported operation |
| 401 | Missing/invalid server bearer key |
| 404 | Unknown/expired session or unknown endpoint |
| 405 | HTTP method not supported |
| 413 | Body exceeds 64 KiB |
| 415 | JSON content type required |
| 500 | Unexpected backend failure; internal exception details are withheld |
| 503 | Chat provider unavailable, or health check reports the application closed |

A failed first chat request discards its newly created session because the caller
has not received the ID. A provider failure in an existing session preserves the
previous conversation so it can be retried.

## Memory and fetched data

`SHOPPING_SESSION_SECONDS=0` keeps the session until it is explicitly reset or
closed, or the backend process stops. A positive value enables idle expiry.
The full conversation stays in RAM; the model directly receives the latest ten
turns and can search older session history with its recall tool. Earlier content
is retained, but model recall is not guaranteed perfect. Restarting the process
loses chats, carts and pending actions. Orders remain in the database.

Startup preparation produces a JSON-compatible report with `schema_version`,
`status`, `store_name`, `currency`, `fetched_at`, `checkout_enabled`, `checks`,
`counts`, `products`, `reviews`, `reviews_available` and `reviews_note`.
Products include string `id` and `name`, integer `price_minor` and `stock`,
`description`, `category` and `currency`. Reviews include `id`, `product_id`,
integer `rating` and `text`. Credentials are excluded.

Fetching reads complete tables in batches, with a maximum of 100,000 records per
table. Larger sources fail explicitly instead of returning truncated success.
The report is held inside the backend; the HTTP routes do not expose a bulk
catalog export. Current shopping facts still come from live database queries.
Missing or unsupported reviews are reported explicitly; custom product mappings
currently do not enable review fetching.

## Database and import compatibility

SQLite, PostgreSQL and MySQL connectors are included. PostgreSQL/MySQL servers
must be provisioned separately. Choose the decoded database password in the
environment variable, rather than a URL-encoded value from a connection URI.
For Supabase on an IPv4 network, use the exact Session pooler connection settings
from the project's Connect panel, normally database `postgres`, port `5432`,
and TLS `require`. The username includes the project reference.

`SHOPPING_DB_SCHEMA` defaults to `public`. Select an existing separate PostgreSQL
schema to keep application tables separate from another catalog. Connections
reject a missing schema instead of falling back to public. Use session pooling,
not transaction pooling, for this session-scoped schema setting. Copying data
between schemas creates independent records; it does not synchronize updates.

A custom product mapping can read an existing catalog without changing it:

```text
SHOPPING_PRODUCT_MAPPING={"id":"sku","name":"title","price":"selling_price","stock":"quantity"}
```

Required canonical product fields are `id`, `name`, `stock`, and `price_minor`
(integer minor units) or `price` (major units); `description` and `category` are
optional. Custom mappings permit catalog reads but disable order writes.

CSV is comma-delimited UTF-8. JSON imports are arrays of records. Maximum import
file size is 10 MB. Review imports need `id`, `product_id`, integer `rating` from
1 to 5, and `text`. Use `--mapping` with the import command when source file fields
differ. Duplicate or existing IDs reject the entire import; source files remain
unchanged. Currency is configured once per store, with two decimal places.

## Order guarantees and limits

- Order creation and conditional stock reduction run in one database transaction.
- Prices use integer minor units. Changed price/name details require a newly confirmed summary.
- Request IDs prevent duplicate checkout. Cancellation restores stock at most once.
- Confirmation belongs to the current customer/session and expires after five minutes.
- The model can prepare an order or cancellation but cannot commit it. The trusted
  caller must show the pending summary and explicitly call the confirmation route;
  conversational "yes" alone does not commit anything.
- Only `confirmed` and `preparing` orders can be cancelled. Payment method is
  `pay_on_delivery`; no gateway, refund or courier tracking is simulated.
- Catalog/review content is untrusted text. The model cannot execute arbitrary SQL,
  change customer identity or bypass customer ownership checks.

## Modules and verification

| Path | Responsibility |
| --- | --- |
| `api/flask.py` | HTTP routes, bearer-key checks, validation, error responses and server runner |
| `main.py` | Headless application orchestration and administrative commands |
| `environment.py`, `config.py`, `security/credential_store.py` | Environment loading, non-secret settings and in-memory credential copies |
| `api/service.py`, `runtime.py` | Startup preparation, catalog report, sessions and component lifecycle |
| `services/setup_service.py`, `services/errors.py` | Headless database setup/import operations and sanitized errors |
| `db/`, `services/` | Database connections, canonical schema, catalog/account queries, cart/order operations |
| `memory/`, `agent/`, `tools/` | Process-local sessions, Groq agent, current-data tools and older-history recall |
| `tests/` | Environment, HTTP/session integration, concurrency, imports, orders and mocked agent checks |

```powershell
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m compileall -q main.py environment.py runtime.py api agent db memory security services tools
.\.venv\Scripts\python.exe -m pip check
```

The default suite uses isolated SQLite databases and mocked provider responses.
It does not establish real Groq or hosted-database connectivity; run `main.py check`
with your credentials for that. MySQL schema compilation is tested, while a live
MySQL server remains unverified. The optional PostgreSQL integration test uses a
separate temporary local instance:

```powershell
$env:SHOPPING_TEST_POSTGRES_BIN = 'C:/Program Files/PostgreSQL/18/bin'
.\.venv\Scripts\python.exe -m pytest tests/test_postgres_integration.py -q
```

Frontend chat, end-user authentication, Express integration, shared/persistent
sessions, fulfillment interfaces, arbitrary order-schema adapters, automatic
source synchronization and embeddings/RAG remain separate extensions.
