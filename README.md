# Veyrix

Conversational commerce, connected to your business.

Veyrix is a headless shopping-agent backend powered by Flask, LangChain and Groq.
It supports catalog/review questions, carts, explicit pay-on-delivery order
confirmation and eligible cancellations. Configuration and credentials come from
environment variables or an optional `.env` file. No desktop interface or chat
frontend is included in the current backend flow.

## Repository layout

- `main_setup/python/`: Flask server, application orchestration, database connectors,
  environment configuration, session memory, shopping tools and automated tests.
- `main_setup/node/`: Express/TypeScript scaffold, not yet connected.
- `main_setup/client/web/`: customer-interface scaffold, not yet connected.
- `web/`: separate React documentation website; it does not call the shopping API.

## Start the backend

Use Python 3.12. From `main_setup/python`:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Edit `.env`: set `GROQ_API_KEY`, `GROQ_MODEL`, your database settings and a strong
random `SHOPPING_API_KEY` of at least 32 characters. The environment file is
ignored by Git. Production hosts can inject process variables, which override
file values. Legacy desktop settings and OS keyring credentials are not loaded.

For a new SQLite demo database:

```powershell
.\.venv\Scripts\python.exe main.py init-db
.\.venv\Scripts\python.exe main.py import examples/products.csv
.\.venv\Scripts\python.exe main.py import examples/reviews.csv --kind reviews
.\.venv\Scripts\python.exe main.py customer --id demo --name "Demo Customer"
.\.venv\Scripts\python.exe main.py check
.\.venv\Scripts\python.exe main.py
```

Skip initialization/imports when connecting to an existing business database.
The server starts only after database/catalog and Groq checks pass. It uses
Waitress at `127.0.0.1:8000` by default, with no Flask debugger or reloader.
`python -m api.flask` and `python api/flask.py` are equivalent server entry points.

## Request flow

`HTTP request → api/flask.py → main.py → session history + live shopping tools → JSON response`

All `/api/*` requests require `Authorization: Bearer <SHOPPING_API_KEY>` and JSON
content. This is a trusted server-to-server key: the upstream service must
authenticate the customer and must not expose the key to a public browser.

A first `POST /api/chat` creates a session:

```json
{"customer_id":"demo","message":"Show me walking shoes."}
```

The response includes `session_id`, `answer` and `pending`. Later requests send
that session ID with the next message:

```json
{"session_id":"<returned-id>","message":"Which of those have the best reviews?"}
```

History and current catalog data are supplied by the backend. Clients cannot
inject history/data or change an existing session's customer ID. Reset, close and
explicit confirmation routes are documented in the
[Python API guide](main_setup/python/README.md).

Memory stays in RAM until reset/close or process shutdown by default. The model
sees recent turns and can search older session history. Use one server process
until a shared session store is implemented. Orders persist in the database.

## Data support and verification

SQLite, PostgreSQL and MySQL connectors are included. CSV/JSON imports populate
an initialized application database. Custom product mappings support catalog
reads; order writes require the canonical application schema. Source files and
arbitrary business schemas are not automatically rewritten.

From the repository root:

```powershell
.\main_setup\python\.venv\Scripts\python.exe -m pytest main_setup/python/tests -q
```

Tests use isolated SQLite databases and mocked Groq responses. Live provider and
hosted-database checks require your own credentials. PostgreSQL integration is
opt-in, and MySQL has schema-compilation coverage without a live-server guarantee.

See the [Python configuration and API guide](main_setup/python/README.md),
[implementation report](main_setup/python/IMPLEMENTATION_REPORT.md),
[Express scaffold](main_setup/node/README.md), and
[customer-interface scaffold](main_setup/client/web/README.md).

The documentation website can be run separately with `npm install --prefix web`
and `npm run dev --prefix web`; see [its README](web/README.md). Frontend chat
implementation and integration remain deferred.
