# Veyrix architecture and file reference

This reference describes authored source, runtime ownership and storage. Dependency manifests and lockfiles define installed versions. Generated builds, installed packages, caches and secret environment files are not application source.

## Services and request flow

| Service | Entry point | Responsibility | Default local port |
|---|---|---|---|
| Commerce API | `setup/node/src/index.ts` | Verified identity, catalog, transactions, durable chats | 8001 |
| AI worker | `setup/python/main.py` | LangChain agent, Groq, request-scoped checkpoint memory and tools | 8000 (`SHOPPING_PORT` overrides it) |
| Chat | `chat/src/main.tsx` | Customer forms, messages and confirmation controls | Vite 5174; built server 4173 |
| Documentation | `web/src/main.tsx` | Product, architecture, setup and demo guides | Vite normally 5173 |

This workspace may use Python port 8002. Node's `PYTHON_API_URL` must match the actual listener.

```text
Browser -> chat proxy -> Node /api/chat -> Python /api/respond
                           |                    |
                     Auth + turn lease     Scope classification
                     Supabase history      LangChain create_agent
                                           Request-scoped checkpoint state
                                                |
                                           Groq + Node /internal/tools
                                                      |
                                                  Supabase
                           |
                     Save answer + release lease -> browser
```

## Agent and memory

`langchain.agents.create_agent` owns agent execution; the application no longer implements the model/tool loop itself. `langchain_groq.ChatGroq` provides the model, while `langchain_core` provides messages and tool schemas. LangChain agents execute on LangGraph.

A request-scoped LangGraph `InMemorySaver` checkpoints agent message state during execution. Verified recent history from Node seeds that state, followed by model responses and tool observations. A fresh checkpointer per request isolates customer conversations and avoids a process-wide customer cache.

Durable conversation memory stays in Supabase. Node supplies the last **20 messages**, each bounded to **8,000 characters**, while preserving the full saved transcript. Temporary checkpoints disappear after the request and do not provide restart recovery. There is no vector store, semantic retrieval, automatic summary or separate cross-chat preference memory. Conversation context is reconstructed from the owned database transcript each turn.

Exact greetings, thanks and simple cart-view requests use deterministic fast paths with no model call. Other requests pass the shopping scope gate before agent execution. Tool identities come from verified request context, never model-generated customer IDs. The agent can prepare checkout/cancellation but cannot commit either; trusted frontend confirmation remains required.

Node forwards at most 20 messages, bounded to 8,000 characters each and a 128 KiB total request payload. Python further bounds agent history to 24,000 characters with 4,000 per message, and classifier history to six messages/6,000 characters. Classifier output budgets depend on the model: reasoning models need room to reason before producing the short label. Model-visible tool JSON stays valid and is compacted to at most 16,000 characters; omitted items/prose are marked partial/truncated, while retained IDs and numeric facts remain intact. Full saved transcripts remain intact.

Clients requesting `Accept: text/event-stream` on `/api/chat` receive fixed `checking`, `working` and `saving` status events, then a final `result` after persistence, or a sanitized `error`. This does not expose raw model tokens. JSON remains supported. Disconnection does not cancel necessary persistence or trigger automatic mutation retries. Timings measure preparation, assistant execution, saving and total request time; they do not establish a production latency guarantee.

Failures after dispatch use `request_outcome_unknown`, since a cart tool may already have committed. The interface hides Retry and asks the customer to reload and check the cart. Successful transcript writes clear the turn lease in the same transaction, avoiding a redundant cleanup write; failure cleanup remains bounded by lease expiry.

`agent/llm_client.py` chooses classifier budgets: supported GPT-OSS 20B/120B models use 512 completion tokens with low reasoning effort; the known non-reasoning `llama-3.1-8b-instant` and `llama-3.3-70b-versatile` models use eight tokens. Other model IDs receive 512 tokens without a forced reasoning parameter. The GPT-OSS main agent defaults to low effort; `GROQ_REASONING_EFFORT=low|medium|high` can override it for supported GPT-OSS models only. The scope classifier remains low effort. The completion budget includes reasoning, not just the visible label.

## Root files

| File | Responsibility |
|---|---|
| `README.md` | Service overview, configuration ownership, startup, customer flow and verification commands. |
| `ARCHITECTURE_INDEX.md` | This filewise reference. |
| `start-dev.ps1` | Launches Node, Python and chat in separate terminals; accepts `-Service node`, `python`, or `chat`. Does not start documentation. |
| `.gitignore` | Excludes secrets, environments, installed packages, builds, caches and local data. |

## Commerce API — `setup/node/`

### Source files

| File | Responsibility and behavior |
|---|---|
| `src/index.ts` | Loads configuration, connects Prisma, reports live-catalog availability and starts Express. Handles listener errors and graceful HTTP/database shutdown. |
| `src/app.ts` | Builds middleware and all HTTP routes. Enforces JSON limits, same-origin browser writes, authentication, private tool bearer authentication, safe errors, no-cache headers and sanitized request logging. |
| `src/config.ts` | Validates remote PostgreSQL configuration, required secrets, delivery fee, public origin and secure-cookie setting; resolves host, ports, Python URL and email settings. |
| `src/database-config.ts` | Shared schema-name allowlist: a simple SQL identifier of 1–63 characters, defaulting to `shopping_agent`. Used by runtime connection and configuration validation. |
| `src/chat-stream.ts` | SSE response helper with fixed progress stages, 15-second heartbeat, committed final result, sanitized errors and disconnect cleanup. Never streams raw provider/tool data. |
| `src/store.ts` | Prisma PostgreSQL adapter/pool, schema selection and verified TLS. Provides serializable transaction retries, JSON helpers and owned-chat checks. |
| `src/security.ts` | Cryptographic tokens, SHA/HMAC, timing-safe comparison, OTP generation and expiry constants; structured errors; email, Indian phone/address validation; cancellation eligibility. |
| `src/auth.ts` | OTP start/verify, persisted identity/IP rate limits, customer resolution, hashed-token auth sessions, new/restored chats, cookie authentication and public account state. |
| `src/commerce.ts` | Address management, cart tools, live catalog access, checkout/cancellation review, owned order lookup, idempotent transactional confirmation and stock updates. Acquires a three-minute chat-turn lease, forwards verified history to Python, saves successful turns and releases leases on completion/failure. |
| `src/email.ts` | HTML/plain-text OTP templates and Resend delivery with per-challenge idempotency; sender validation and sanitized provider failures. |

### HTTP routes

| Route | Behavior |
|---|---|
| `GET /api/health` | Database reachability and email configuration status. |
| `POST /api/auth/start` | Begins login or chat-restoration email verification. |
| `POST /api/auth/verify` | Consumes OTP and sets an opaque session cookie. |
| `GET /api/account` | Owned profile, addresses and current chat state. |
| `POST /api/auth/logout` | Revokes session and clears cookie. |
| `POST /api/account/profile` | Completes/updates owned name and Indian phone. |
| `POST /api/addresses` | Saves a validated owned address. |
| `POST /api/checkout/prepare` | Reviews selected address, cart and live prices. |
| `POST /api/chat` | Leased, authenticated call to Python; JSON by default, fixed progress SSE when requested through the Accept header, final answer after persistence. |
| `POST /api/chat/confirm` | Commits reviewed order/cancellation with idempotency and transactional rechecks. |
| `POST /api/chat/end` | Preserves transcript and marks the chat ended. |
| `POST /api/chat/reset` | Creates a new conversation without deleting the old one. |
| `POST /api/chat/restore` | Rejects direct restoration; fresh OTP flow is required. |
| `POST /api/orders/lookup` | Reads an owned order. |
| `POST /api/orders/cancel/prepare` | Prepares an eligible owned cancellation. |
| `POST /internal/tools` | Private tool dispatcher; checks bearer key, ownership, active session and turn lease. Not exposed by the browser proxy. |

### Database, configuration and tests

| File | Responsibility |
|---|---|
| `prisma/schema.prisma` | Models existing products/reviews/customers/orders/items/events, Veyrix addresses/chats/auth sessions/OTP challenges, and live catalog views. Chat stores message/cart/pending JSON plus lease fields. |
| `prisma/upgrade-existing.sql` | Additive contact/delivery fields and private Veyrix tables, including RLS/browser-role restrictions. Does not reset business data. |
| `prisma/live-catalog.sql` | Normalized live SQL views over public products/reviews and stock-write support; preserves historical order references. |
| `prisma.config.ts` | Prisma CLI schema and direct connection configuration. |
| `certs/supabase-prod-ca-2021.crt` | Public CA used to verify hosted Supabase connections. |
| `certs/README.md` | Certificate provenance and usage. |
| `.env.example` | Non-secret configuration template; actual credentials are excluded from this index. |
| `package.json`, `package-lock.json` | Express/Prisma/Zod/dotenv dependencies, npm scripts and exact dependency resolution. |
| `tsconfig.json` | Server TypeScript compiler configuration. |
| `README.md` | Service setup, additive migrations, authentication, catalog and isolated integration instructions. |
| `email-preview.html` | Static OTP design preview using a fictional code. |
| `tests/security.test.ts` | Security and validation helper tests. |
| `tests/sql-security.test.ts` | Schema identifier rejection, hostile search values retained as Prisma data, arbitrary tool-name rejection and customer-scoped order filters. Uses captured fake Prisma operations; not a live database penetration test. |
| `tests/chat-stream.test.ts` | Fixed progress, persistence-before-result, sanitized error and disconnection behavior for SSE responses. |
| `tests/email.test.ts` | Template/sender/mocked delivery tests. |
| `tests/workflows.test.ts` | Isolated transaction fakes covering auth, ownership, checkout, stock/price changes, cancellation, leases and retries. |
| `tests/integration.ts` | Real HTTP/Prisma checks limited to an explicit disposable test schema; email is intercepted. |
| `tests/run-isolated-integration.py` | Creates a uniquely named remote test schema, installs structures, runs integration checks and removes only that schema. Separate from default tests. |

## Python worker — `setup/python/`

### Active worker files

| File | Responsibility and behavior |
|---|---|
| `main.py` | Default/`serve` entry point delegates to the private HTTP worker. Explicit `check`, `init-db`, `import` and `customer` commands retain administrative workflows. `create_application` prepares an administrative runtime only, with no agent session. |
| `agent/stateless.py` | `StatelessAssistant.respond` performs scope classification, constructs ten remote tools and invokes `create_agent`. Configures six model calls and ten tool calls per run through LangChain middleware, a safe tool-error wrapper, `max_concurrency=1` for ordered tool execution and recursion limit 60. Creates `InMemorySaver`, hydrates recent messages, and deletes the thread in `finally`. Also owns system prompts, result secret stripping, output sanitization and `CommerceTools` HTTP transport. |
| `agent/errors.py` | Shared `ProviderUnavailable` exception without importing the removed legacy agent. |
| `agent/llm_client.py` | Shared Groq model-option validation and reasoning-aware classifier budgets used by the active worker, plus model construction for administrative provider checks. |
| `api/stateless.py` | Constructs `ChatGroq` and the assistant, validates private bearer authentication and request shape, normalizes history and exposes `/health` plus `/api/respond`. Uses sanitized errors and request logs; creates no local database/session store. |
| `api/flask.py` | Worker factory and Waitress startup, host/port validation, shutdown and sanitized startup errors. The old injected stateful HTTP adapter is removed. |
| `environment.py` | Loads `.env` without interpolation, preserving literal credential characters; environment values take precedence. Also supports explicit administrative configuration/credential loading. |
| `.env.example` | Worker and administrative configuration examples; no real credentials. |
| `requirements.txt` | Runtime ranges for LangChain, LangGraph, LangChain Groq/core, Flask, Waitress and dotenv; SQLAlchemy/database drivers remain for retained administration utilities. |
| `requirements-dev.txt` | Runtime requirements plus pytest. |
| `requirements-lock.txt` | Exact resolved Python environment, including transitive graph/checkpoint dependencies. |
| `README.md` | Worker setup, LangChain memory ownership, private contract, tools and tests. |

The six-call limit applies to agent model execution; the initial scope-classification model call is separate. The tool limit is total per run, not per individual model response. Checkpoint cleanup runs for both successful and failed graph invocations.

### Retained administration utilities

These files support explicit database administration and isolated compatibility/integration tests. They are not a second deployed shopping agent or a customer-session memory system.

| File | Responsibility |
|---|---|
| `api/__init__.py` | Lazy exports for `PreparedApplication` and `prepare_application`. |
| `api/service.py` | Administrative preparation: validates database/catalog, fetches product/review records in bounded batches, optionally checks Groq, emits progress and returns a JSON-serializable readiness report. `PreparedApplication.close` releases its runtime. |
| `config.py` | Non-secret administrative configuration dataclass, validation and optional configuration-file save/load. Not the HTTP worker's conversation storage. |
| `runtime.py` | Administrative SQL engine, catalog, cart and order services; disposal and credential cleanup. No `SessionStore`. |
| `security/credential_store.py` | Temporary credential holder; refuses persistent writes and supports clearing. |
| `db/connection.py` | SQLAlchemy connection construction for supported administrative databases. |
| `db/models.py` | Canonical SQLAlchemy table metadata also used by the isolated Node integration bootstrap. |
| `db/catalog_repository.py` | Administrative catalog reflection, field mapping, normalization and query access. |
| `db/account_repository.py` | Customer-filtered SQL order/item retrieval for administrative compatibility. |
| `db/accountWiseDataDB.py` | Compatibility import for `AccountRepository`. |
| `db/db_setup.py` | Explicit canonical-schema initialization and writability checks. |
| `db/dbSetup.py` | Compatibility imports for initialization/writability. |
| `db/importers/files.py` | CSV/JSON import parsing, mapping and record validation. |
| `services/setup_service.py` | Database inspection, initialization and file import orchestration with engine cleanup. |
| `services/cart_service.py` | Administrative cart validation and pricing helpers. |
| `services/order_service.py` | Retained SQL order/stock transaction logic for administrative compatibility/tests; public checkout remains in Node. |
| `services/errors.py` | Safe setup/startup error descriptions. |
| `agent/__init__.py`, `db/__init__.py`, `db/importers/__init__.py`, `security/__init__.py`, `services/__init__.py` | Python package markers. |

### Python tests

| File | Coverage |
|---|---|
| `tests/conftest.py` | Isolated configuration/database/runtime fixtures. |
| `tests/test_stateless_assistant.py` | Real LangChain graph with fake model/commerce: tool round trips, verified identities, scope rejection, safe errors/secrets, ordered tools, model/tool limits, checkpoint cleanup/isolation, bounded history and HTTP round trip. |
| `tests/test_sql_security.py` | Real isolated SQLite checks for hostile imported product literals, parameterized executed queries, unchanged tables, order ownership, safe table reflection and rejected schema identifiers. |
| `tests/test_admin_commands.py` | Explicit administration CLI operations. |
| `tests/test_api_service.py` | Administrative preparation/report/progress behavior. |
| `tests/test_environment.py` | Environment loading and precedence. |
| `tests/test_setup_config.py` | Configuration and temporary credential behavior. |
| `tests/test_setup_errors.py` | Setup error handling. |
| `tests/test_startup_errors.py` | Safe startup failure descriptions. |
| `tests/test_startup_progress.py` | Sanitized progress output. |
| `tests/test_importers.py` | Input mapping, validation and imports. |
| `tests/test_orders.py` | Retained administrative order/stock behavior. |
| `tests/test_dialect_contract.py` | SQL database-dialect contract checks. |
| `tests/test_postgres_integration.py` | Opt-in PostgreSQL integration, separate from ordinary isolated execution. |

Removed obsolete modules: `agent/agent.py`, `agent/prompts.py`, `agent/extractor.py`, `memory/`, `tools/`, `cli.py`, `db/chat_memory.py` and the stale `IMPLEMENTATION_REPORT.md`. Their legacy agent/session tests (`test_agent`, `test_memory`, `test_session_recall`, `test_main_flow`, `test_http_api`, `test_server_roundtrip`) were replaced by coverage of the active worker rather than retaining an unused second execution path.

### Private contract and tools

`GET /health` reports worker availability. `POST /api/respond` requires the private `SHOPPING_API_KEY` bearer credential and exactly `chat_id`, `customer_id`, `turn_id`, `message`, and `history`. New messages are bounded to 8,000 characters; at most 100 supplied history entries are validated/normalized, with the model using a bounded recent window. Node normally sends 20 messages.

Python returns `answer` and optionally `action: "checkout"`. Tool requests go to Node `/internal/tools` with `INTERNAL_API_KEY` and the active turn ID. Confirmation/authentication secrets are stripped from model-visible results.

| Tool | Behavior |
|---|---|
| `product_search` | Current products, optionally limited by price in paise. |
| `product_details` | Current details using an exact returned product ID. |
| `product_reviews` | Stored product reviews. |
| `cart_view` | Current owned chat cart. |
| `cart_add` | Sets total quantity; relative additions require a prior cart read. |
| `cart_remove` | Removes one product. |
| `cart_clear` | Clears the cart on request. |
| `order_history` | Owned orders, optionally one order ID. |
| `prepare_order` | Opens address/delivery UI; does not place an order. |
| `prepare_cancellation` | Prepares review; does not cancel an order. |

## Customer application — `chat/`

| File | Responsibility |
|---|---|
| `src/main.tsx` | React bootstrap and global styles. |
| `src/App.tsx` | Coordinates account loading, identity/OTP/profile, conversation, address selection, checkout, lookup/cancellation, confirmations and chat/session lifecycle. Holds transient UI state. |
| `src/lib/api.ts` | Same-origin JSON helper plus `requestChat` SSE handling, JSON compatibility and interruption errors without automatic retry. |
| `src/lib/chat-stream.mjs` | Incremental SSE decoder for fixed progress, result and error events; validates stream completion. |
| `src/lib/chat-stream.d.mts` | Type declarations for stream stages, results and errors. |
| `src/lib/utils.ts` | Conditional class-name merging. |
| `src/components/commerce-cards.tsx` | Identity, OTP, profile, delivery and farewell cards; shared customer/address types. |
| `src/components/commerce-cards.test.tsx` | Component rendering assertions; separate from default server-test glob. |
| `src/components/confirmation-card.tsx` | Review details and explicit order/cancellation confirmation. |
| `src/components/ui/ai-chat-card.tsx` | Chat shell, message list and composer. |
| `src/components/ui/markdown-response.tsx` | Markdown/GFM assistant answer rendering. |
| `src/components/ui/markdown-response.css` | Markdown typography/layout. |
| `src/components/ui/response-stream.tsx` | Final response presentation; separate from fixed server progress events and not raw backend model-token streaming. |
| `src/components/ui/response-stream.css` | Response presentation styles. |
| `src/components/ui/thinking-orbs.tsx` | Animated pending indicator wrapper. |
| `src/components/ui/thinking-status.tsx` | Pending-response status presentation. |
| `src/components/ui/ai-chat-card-utils/use-typewriter.ts` | Typewriter presentation hook. |
| `src/styles.css` | Chat tokens, forms, layout and responsive styles. |
| `server/api.mjs` | Allowlisted same-origin API proxy; localhost/origin/method/body validation, cookie forwarding, bounded timeouts and sanitized errors. No session store. |
| `server/config.mjs` | Optional chat environment loading and commerce upstream URL. |
| `server/index.mjs` | Built asset server and proxy on loopback; SPA fallback and traversal checks. |
| `server/api.test.mjs` | Proxy request, forwarding and failure tests. |
| `server/chat-stream.test.mjs` | Client stream parser regression tests including split chunks, final results and interruptions. |
| `vite.config.ts` | React/Tailwind, alias, strict port 5174, development proxy and config watching. |
| `index.html` | Browser shell and React mount point. |
| `public/favicon.svg` | Chat brand icon. |
| `.env.example` | Optional commerce URL; no service secrets. |
| `package.json`, `package-lock.json` | React, Markdown, motion, icons, build tooling and exact dependency resolution. |
| `tsconfig.json` | Frontend compiler configuration. |
| `components.json` | UI component tooling configuration. |
| `README.md` | Chat setup and usage. |

## Documentation frontend — `web/`

### Pages and content

| File | Responsibility |
|---|---|
| `src/main.tsx` | React mount, fonts and global styles. |
| `src/App.tsx` | Routes, navigation and shared documentation layout. |
| `src/pages/Home.tsx` | Product landing page and documentation entry points. |
| `src/pages/Overview.tsx` | Shopping workflow, capabilities, storage and confirmation concepts. |
| `src/pages/Architecture.tsx` | Interactive layers, request flow, agent/memory and state lifetime reference. |
| `src/pages/Quickstart.tsx` | Prerequisites, environment setup, startup commands and troubleshooting. |
| `src/pages/Status.tsx` | Capability/limitation reference, not live production monitoring. |
| `src/pages/DemoChat.tsx` | Demo walkthrough, screenshots and separate chat-app entry point. |
| `src/pages/demo-chat.css` | Walkthrough/gallery styling. |
| `src/pages/quickstart-resources.css` | Setup resource/checklist styling. |
| `src/pages/status.css` | Capability presentation styling. |
| `src/content/hero.ts` | Typed landing-hero narrative. |
| `src/content/repository.ts` | Shared public repository URL and label. |
| `src/content/setup-resources.ts` | Required/optional resources and official setup links. |
| `src/lib/repository.ts` | Source-file link construction. |
| `src/lib/utils.ts` | Class-name helper. |

### Components

| File | Responsibility |
|---|---|
| `src/components/docs/document-parts.tsx` | Section wrappers, on-page navigation, disclosures, callouts and related links. |
| `src/components/route-page.tsx` | Lazy page loading and route skeletons. |
| `src/components/code-block.tsx` | Reusable command/code presentation. |
| `src/components/technology-marquee.tsx` | Technology list presentation. |
| `src/components/ui/ai-agent-pipeline.tsx` | Desktop/mobile animated architecture illustration; not connected to live execution. |
| `src/components/ui/neon-hello.tsx` | Supplied handwritten hello renderer with the original stroke geometry, WebGL glow and SVG fallback. Used with Veyrix silver/lavender colors. |
| `src/components/site-preloader.tsx`, `src/components/site-preloader.css` | Brief full-page welcome on initial load, mounted outside routing. Accelerated original writing, single-line welcome caption, fade/lift exit, Skip/Escape, reduced-motion bypass and cleanup. The page loads beneath the overlay. |
| `src/components/ui/dimensional-workflow-hero.tsx` | Scroll-driven narrative, workflow panels and hero animation settings. |
| `src/components/ui/dot-field.tsx` | Decorative interactive dot-field rendering. |
| `src/components/ui/halftone-wordmark-footer.tsx` | Halftone brand/footer, visual presets and navigation. |
| `src/components/ui/feature-section-with-hover-effects.tsx` | Feature grid and hover effects. |
| `src/components/ui/feature-section-with-hover-effects.css` | Feature-grid layout and motion styles. |
| `src/components/ui/anti-metal-button.tsx`, `anti-metal-button.css` | Styled button and its visual rules. |
| `src/components/ui/button-1.tsx` | Additional reusable button presentation. |
| `src/components/ui/github-repo-button.tsx`, `github-repo-button.css` | Repository link and styles. |
| `src/components/ui/interactive-hover-button.tsx`, `interactive-hover-button.css` | Button/router-link hover variants. |
| `src/components/ui/marquee.tsx`, `marquee.css` | Reusable scrolling strip with pause/direction/fade controls. |
| `src/components/ui/terminal.tsx`, `terminal.css` | Animated command examples; displays commands without executing them. |

### Styles, hosting and assets

| File | Responsibility |
|---|---|
| `src/styles.css` | Global brand and layout styles. |
| `src/documentation.css` | Shared document typography, cards, sections and tables. |
| `src/responsive.css` | Responsive overrides. |
| `public/screenshots/demochat/manifest.json` | Gallery metadata. |
| `public/screenshots/demochat/README.md` | Screenshot maintenance guidance. |
| Other `public/` images/icons | Static visual assets, no application state. |
| `public/_redirects` | Static-host SPA fallback. |
| `vercel.json` | Vercel routing/deployment configuration. |
| `vite.config.ts` | React/Tailwind plugins, alias and development server configuration. |
| `index.html` | Documentation browser shell. |
| `package.json`, `package-lock.json` | React Router, GSAP, Framer Motion, fonts/icons and build tools with exact resolution. |
| `tsconfig.json` | TypeScript configuration. |
| `components.json` | UI component tooling configuration. |
| `README.md` | Documentation-site setup. |

## State lifetimes and security

| State or boundary | Ownership and behavior |
|---|---|
| Full transcript, cart, pending review | Supabase `veyrix_chats` through Node/Prisma; ending a chat preserves messages. |
| Agent messages/tool observations | Request-scoped LangChain/LangGraph message state and in-memory checkpoints; rebuilt from verified transcript next turn. |
| Browser session | Opaque HttpOnly, SameSite=Strict cookie; only hash is persisted. Secure flag follows deployment configuration. |
| Auth/OTP expiry | Sessions: 30 minutes. OTP: 10 minutes, at most five failed attempts. |
| Pending review | Five minutes; confirmation rechecks ownership/status/prices/stock. |
| Turn serialization | Three-minute Node lease; tools require current token and active verified session. |
| Catalog | Live views over public products/reviews; live IDs use `public:<id>`, historical order snapshots remain separate. |
| Order/stock writes | Serializable transactions, bounded conflict retries and idempotent confirmation. |
| Node -> Python | Private `SHOPPING_API_KEY` bearer credential. |
| Python -> tools | Separate `INTERNAL_API_KEY`, verified identity and turn token. |
| Browser -> database/model | No direct access; secrets are excluded from frontend variables and model context. |
| SQL injection defenses | Prisma/SQLAlchemy bind customer values; configured schemas use an identifier allowlist. Read-only source audit found no confirmed injection issue. New regression tests check hostile literals and ownership; this is not a claim of comprehensive penetration testing. |
| Retention | No automatic transcript deletion policy; session expiry restricts access without erasing stored data. |

## Verification

Run from the repository root after dependency installation:

```powershell
.\setup\python\.venv\Scripts\python.exe -m pytest setup/python/tests -q
npm test --prefix setup/node
npm run build --prefix setup/node
npm test --prefix chat
npm run build --prefix chat
npm run build --prefix web
```

Default tests use isolated fixtures/mocks. Remote integration is a separate explicit operation documented in `setup/node/README.md`. Generated `dist/`, `node_modules/`, `.venv/`, caches and private environment files are intentionally excluded from the authored-file inventory.
