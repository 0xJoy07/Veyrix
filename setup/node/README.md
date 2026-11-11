# Veyrix commerce service

The TypeScript service owns customer verification, addresses, chats, carts and order
transactions. Prisma talks directly to Supabase PostgreSQL. Python receives only
the current request's verified customer, chat ID, turn ID and recent history; no
customer/session state is persisted in Python or local files. Browser identity is
an opaque HttpOnly cookie whose SHA-256 hash is stored in Supabase.

## Setup

Use Node 22.12+ (Node 26 was used during development). From `setup/node`:

```powershell
npm install
npm run prisma:generate
npm run build
npm test
npm run dev
```

Prisma 7 uses the PostgreSQL driver adapter. `prisma.config.ts` supplies the CLI
connection from `DIRECT_URL`; runtime explicitly supplies the URL's `schema`
parameter to `PrismaPg` instead of relying on the PostgreSQL driver's search path.
Hosted Supabase connections trust its official public CA bundled in `certs/`,
with certificate-chain and hostname verification enabled. A custom trusted CA
can be selected with `DATABASE_SSL_CA`; never disable TLS verification globally.

Copy `.env.example` to `.env` only if `.env` does not exist. Set `DATABASE_URL` and
`DIRECT_URL` to the remote Supabase database, including `schema=shopping_agent`.
Use the existing database-owner connection; it must access the canonical tables
and the new private `veyrix_*` tables. Put Resend's key and verified-domain sender
in `RESEND_API_KEY` and `RESEND_FROM`. Never put credentials in `VITE_*` variables.
`OTP_SECRET`, `INTERNAL_API_KEY`, and `SHOPPING_API_KEY` each need at least 32 random
characters. Share only the appropriate service keys with the Python worker.

The service listens on `127.0.0.1:8001` by default. The chat frontend proxies its
`/api/*` requests here. `PUBLIC_ORIGIN` must exactly match the browser origin.
For production HTTPS set `COOKIE_SECURE=true`; keep `/internal/*` private.
The health response reports whether email settings are present. Missing mail
settings prevent verification rather than silently using a local/demo identity.

## Existing data

The Prisma schema maps the inspected canonical tables in `shopping_agent`.
`prisma/upgrade-existing.sql` is an additive upgrade: nullable customer contact
fields, nullable order delivery snapshots, and new private tables. It does not
delete or recreate existing product/customer/order data. Inspect the target and
take a backup before applying this SQL. Do **not** use `prisma migrate reset` or
`db push --accept-data-loss` on this database. Before adopting Prisma Migrate,
baseline the actual existing schema; do not treat it as an empty database.

Existing customers with no email remain unclaimable through the public flow. An
administrator must independently establish ownership before associating a
verified email. Matching a name, knowing a legacy customer/order ID, or entering
another person's phone never merges accounts. Phone lookup sends OTP only to the
email already attached to that customer. A new customer is created only after
email verification; checkout requires their name and Indian mobile number.

All private Veyrix tables have RLS enabled and no browser-role access. The Prisma
service explicitly checks ownership on every customer-specific operation. It
uses the database owner connection, so these application checks are mandatory.
No Supabase service credential is exposed to the frontend.

## Verification and saved conversations

- Codes are cryptographically generated six-digit values, valid for exactly ten
  minutes. Only HMAC hashes are stored; expiry is checked server-side using a
  fresh clock inside the transaction. A code can be consumed once.
- Five failed attempts exhaust a challenge. Resend invalidates previous codes,
  including requests made through another email/phone alias for the same account.
  Requests have a 60-second cooldown, five/hour per identity/email and twenty/hour
  per network address. These limits are persisted in Supabase.
- Unknown/mismatched identities receive the same outward response. Existing
  customer details are never returned before verification. Delivery failures are
  logged without the email, OTP or provider response; users can retry after the
  cooldown. The service does not pretend a failed OTP has verified anyone.
- Auth sessions expire after 30 minutes. Every database tool call also requires
  an active session and the current unexpired chat-turn lease. Logout revokes
  the session; no future tool invocation can use it if no valid session remains.
- End chat saves the conversation and returns a greeting with its chat ID. To
  restore it, request a new OTP with `purpose:"chat"` and `chat_id`; an ID alone
  cannot retrieve a conversation. A saved ended chat remains read-only; New chat
  starts a separate conversation without deleting the previous one.

## Checkout

The frontend collects name, Indian mobile number, street address, landmark, city,
state/union territory and six-digit PIN. The customer selects a saved address or
adds a new one. PIN validation checks format, not carrier serviceability.
Each order receives an immutable delivery snapshot. Prices, stock and delivery
charges are checked again at confirmation. Payment is pay on delivery only.

Orders, stock adjustments, item rows, events and pending-state changes are in a
serializable transaction with bounded conflict retries. Order and cancellation
confirmations are idempotent. Only `confirmed`/`preparing` orders may be cancelled;
dispatch between preview and confirmation blocks cancellation without changing
stock. The assistant can prepare actions but cannot confirm an order/cancellation.
Only the explicit frontend confirmation endpoint commits them.

Cart tool `cart_add` sets the requested total quantity, making a retried tool call
idempotent. For “add one more,” the assistant reads the current cart first. A
provider failure can leave a successfully applied cart edit; inspect the cart
before retrying a relative quantity request. Failed model responses do not append
duplicate user messages. Chat content, carts, pending actions and leases all live
in Supabase. The process holds only temporary request data and connection pools.

## Tests and email

`npm test` uses isolated in-memory transaction fakes and mocked email delivery;
it never sends an email or mutates production Supabase records. Tests cover OTP
expiry/reuse/attempts, alias invalidation, account conflicts, checkout ownership,
stock/price changes, dispatch races, duplicate confirmations and tool leases.
These do not replace a staging-database concurrency test with real PostgreSQL.

`npm run test:integration` exercises the HTTP API and actual Prisma operations,
with Resend intercepted. It requires `VEYRIX_TEST_DATABASE_URL` pointing to an
already-prepared isolated schema named `veyrix_test_<8–32 hex characters>` and
refuses every other schema. Create the canonical schema plus additive upgrade
there before the test, then remove that disposable schema afterward. The script
does not create/drop schemas or run against the live `shopping_agent` schema.

`src/email.ts` contains the Veyrix HTML and plain-text OTP templates. The preview
in `email-preview.html` uses the clearly fictional code `123456`. Do not log or
save real OTP emails locally. Resend requests use an idempotency key per challenge.

No cleanup job is enabled automatically: conversation retention and deletion need
an explicit business policy. Expired auth/OTP records are inaccessible but may be
periodically pruned in Supabase after the rate-limit retention window.

For a complete isolated-schema run from the repository root, use:

```powershell
.\setup\python\.venv\Scripts\python.exe setup/node/tests/run-isolated-integration.py
```

This creates a uniquely named temporary schema in the configured remote database, runs the real Prisma/HTTP checks with fictional data and mocked email, then removes only that schema. Existing business tables are not used by the test.

## Authoritative product catalog

The active catalog is `public.products` (prices in rupees, `stock_quantity`, `is_active`) and `public.reviews`. Apply `prisma/live-catalog.sql` after the base upgrade. The `shopping_agent.live_products` and `live_reviews` SQL views read the public tables on every request; they are not materialized copies. Prisma stock updates through the live product view update `public.products.stock_quantity` in the same checkout/cancellation transaction.

`CATALOG_SOURCE=public` is the default. `legacy` is reserved for legacy test fixtures. Historical product IDs remain separate: live IDs are `public:<id>` and order items reference `live_product_id`; older rows retain their original `product_id` and FK. Changing the public catalog never overwrites old order snapshots. Old-cart items must be removed before checkout against the current catalog. No automatic fallback to the copied catalog occurs.
