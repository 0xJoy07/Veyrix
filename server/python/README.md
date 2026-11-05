# Shopping Agent Python Backend

Local business setup with Tkinter, LangChain/Groq chat, catalog/review tools,
temporary carts and sessions, and confirmed pay-on-delivery orders.
The Flask file is intentionally untouched. This release uses a trusted local CLI
for customer conversations; it is not a public authenticated web service.

## Install and launch

Use Python 3.12 with Tk support (the standard python.org Windows installer includes
Tkinter). From `server/python`:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe main.py setup
```

`requirements-lock.txt` records the exact dependency versions used during validation.
Use `pip install -r requirements-lock.txt` to reproduce that environment.

The GUI collects business settings, Groq model/API key, source connection settings,
and database passwords. Secrets are session-only by default. Check **Remember
credentials** to store them in the OS keyring. Plaintext credential files are never
created. The CLI asks again for secrets not saved in the keyring.

### First demo with CSV/JSON

1. Select SQLite and choose a new database file.
2. Click **Initialize empty database**. Existing non-empty databases are rejected.
3. Import `examples/products.csv`; optionally import `examples/products.json` and
   `examples/reviews.csv`. Preview records before importing.
4. Enter your Groq API key and a current tool-capable model ID. Test Groq.
5. Validate and save setup. Settings go to `state/config.json`.
6. Register a local test customer, then start chat:

```powershell
.\.venv\Scripts\python.exe main.py customer --id demo --name "Demo Customer"
.\.venv\Scripts\python.exe main.py chat --customer demo
```

Ask for walking shoes, request a cart quantity, and provide a delivery address.
The CLI prints the pending summary separately from the model response. Use
`/confirm CONFIRMATION_ID` to place an order or confirm a cancellation. Conversational
"yes" alone never commits a transaction. `/reset` clears the session; `/quit` closes it.

Customer selection in this CLI is a **trusted administrator test facility**. Do not
expose it as public authentication. Future HTTP integration must supply identity from
verified authentication, not a customer ID submitted in chat.

## Sources and compatibility

| Source | Behavior |
| --- | --- |
| SQLite | Connect to a local file. Canonical application schema supports orders. |
| PostgreSQL | Local or hosted connection, username/password and TLS settings. |
| MySQL | SQLAlchemy/PyMySQL connector; TLS or explicitly disabled TLS for local testing. |
| CSV/JSON | Import into an initialized application database; recommended local target is SQLite. |
| Custom product schema | Explicit mapping enables catalog reads; order writes remain disabled. |

Online/offline is a hosting choice, not a different database format. Groq always
requires internet. PostgreSQL/MySQL servers must be installed/provisioned separately.
This application does not automatically convert or modify arbitrary business schemas.

Connection testing displays table/column names and sample products. A custom mapping
maps canonical fields to existing columns, for example:

```json
{"id":"sku","name":"title","price":"selling_price","stock":"quantity"}
```

Supported canonical product fields: `id`, `name`, `stock`, `price_minor` (integer
minor currency units) or `price` (major units), optionally `description`, `category`.
Review imports use `id`, `product_id`, integer `rating` from 1 to 5, and `text`.
CSV is comma-delimited UTF-8; JSON is an array of records. Maximum file size is 10 MB.
Duplicate/existing IDs reject the entire import. Reimport never overwrites live stock.
Source files are not synchronized or rewritten. Currency is configured once per store;
this prototype uses two decimal places and does not mix currencies.

Initialization creates schema version 1 only in an empty database. Existing application
databases are validated, not rebuilt. There are no destructive reset/migration commands.
Future schema versions require an explicit migration before writes are enabled.

## Modules

| Path | Responsibility |
| --- | --- |
| `main.py`, `cli.py`, `runtime.py` | Entry points, trusted demo client, component lifecycle |
| `config.py` | Non-secret profile validation and atomic configuration saves |
| `setup_ui/app.py`, `setup_ui/controller.py` | Tkinter forms and background setup operations |
| `security/credential_store.py` | OS keyring and session-only credentials |
| `db/connection.py` | SQLite/PostgreSQL/MySQL connections through SQLAlchemy dialects |
| `db/models.py`, `db/db_setup.py` | Canonical schema, version validation, empty-database initialization |
| `db/catalog_repository.py` | Mapped catalog reads and canonical review queries |
| `db/account_repository.py` | Customer-scoped order queries |
| `db/importers/files.py` | CSV/JSON parsing, field mappings, all-or-nothing imports |
| `memory/session_store.py`, `memory/chat_memory.py` | Session expiry, bounded history, temporary carts and pending actions |
| `services/cart_service.py`, `services/order_service.py` | Cart validation, confirmations, transactional orders and cancellation |
| `agent/agent.py`, `agent/llm_client.py`, `agent/prompts.py` | Groq configuration, bounded tool loop, grounded seller behavior |
| `tools/*_tools.py` | Separate catalog, review, cart, order, and policy tools |
| `tests/` | Core behavior, concurrency, access isolation, imports, configuration, mocked agent tests |

Original camel-case database modules are compatibility imports. `agent/extractor.py`
documents why structured tool inputs replace a separate text extractor.

## Order guarantees and limits

- Order creation and conditional stock reduction occur in one transaction.
- Price/name changes require a new confirmed summary. No floating-point money arithmetic.
- Request IDs prevent duplicate checkout; cancellation conditionally changes status and
  restores stock once. A repeated cancellation confirmation is rejected safely.
- Confirmation expires after five minutes and belongs to the current customer/session.
- Only `confirmed` and `preparing` orders can be cancelled. This status policy is fixed
  in the prototype; policy prose must not promise broader cancellation eligibility.
- New orders are `confirmed`, with `payment_method=pay_on_delivery`. No gateway, refund,
  courier tracking, or payment collection status is simulated.
- The agent cannot commit actions, execute arbitrary SQL, or choose a customer identity.
- Chats, carts, and pending actions are RAM-only. Idle cleanup runs at least every
  30 seconds. Orders persist. Process restarts discard chats. One application process
  is supported; multiple workers need a shared session store.
- Provider and unexpected database errors use generic messages to avoid exposing secrets.
- Catalog/review text is untrusted content. SQL operations remain fixed application code.

## Verification

```powershell
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m compileall -q agent db memory security services setup_ui tools
```

Automated default tests use isolated SQLite databases and a mock model, with no API key.
Real Groq requests can be checked through **Test Groq**. External PostgreSQL/MySQL
connections require an accessible test server; do not use production data for tests.

Validation performed: 31 standard tests passed, the Tkinter setup window constructed
successfully, and `pip check` reported no broken requirements. A separate live
PostgreSQL 18 integration test passed against a temporary local instance. MySQL DDL
compilation is tested, but no live MySQL server was available. Live Groq chat requires
your own credentials and has not been exercised with a real key.

To run the isolated PostgreSQL test on Windows (it creates and stops its own database):

```powershell
$env:SHOPPING_TEST_POSTGRES_BIN = 'C:/Program Files/PostgreSQL/18/bin'
.\.venv\Scripts\python.exe -m pytest tests/test_postgres_integration.py -q
```

The default suite skips this opt-in test when the variable is unset. Test server
initialization uses a temporary directory and loopback-only connections, never an
existing business database.

## Deferred features

Flask/Express integration, real customer authentication, fulfillment operator UI,
arbitrary business order-schema adapters, automated synchronization, and embeddings/RAG
are separate extensions. The working prototype retrieves live catalog data and reviews
directly; it does not need a vector database. Semantic search can be added without
changing the live source of prices, stock, orders, or authorization.
