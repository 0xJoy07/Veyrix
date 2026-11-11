# Veyrix

Conversational commerce with verified customers, interactive checkout, and Supabase persistence.

## Services

- `chat/`: React interface and same-origin API proxy, port 5174. No demo identity or server-side session map.
- `setup/node/`: TypeScript commerce service with Prisma, port 8001. Owns customers, email OTPs, sessions, saved addresses, chats, carts, orders and cancellations in Supabase.
- `setup/python/`: Stateless Groq shopping assistant (this workspace uses port 8002; SHOPPING_PORT controls it). Receives verified conversation context per request and calls the private commerce tools. Its default server does not open a local database or use the legacy memory store.
- `web/`: Separate documentation website.

Request flow: browser → Node commerce service → Python assistant → private Node tools → Supabase.

## Configuration

The existing Supabase database is retained. Follow `setup/node/README.md` for the additive database update and service setup. Do not use a database reset or blindly push a replacement schema over existing data.

`setup/node/.env` holds the Supabase connection, server secrets, `RESEND_API_KEY`, and `RESEND_FROM` (a verified sender address). `setup/python/.env` holds the Groq settings and matching internal API secrets. Never put secrets in `VITE_*` variables. `chat/.env` only needs `COMMERCE_API_URL` if the Node service is not at `http://127.0.0.1:8001`.

Start these in separate terminals from the repository root:

```powershell
# Commerce service; after dependencies, Prisma generation and database setup
npm run dev --prefix setup/node

# Stateless assistant
.\setup\python\.venv\Scripts\python.exe setup/python/main.py

# Chat interface
npm run dev --prefix chat
```

Visit http://127.0.0.1:5174. Use the same origin configured by `PUBLIC_ORIGIN` in the Node service.

## Customer flow

Customers enter their email or Indian mobile number. New customers provide their name, email and mobile number. A six-digit email OTP expires after exactly 10 minutes, is single-use, and is invalidated when replaced. Failed attempts and repeated requests are limited. Order and chat access require an authenticated, verified owner; knowing an ID alone never grants access.

Existing customers without an email in the old schema must have a verified email linked by an administrator. The application never guesses ownership or attaches old orders to a newly entered email.

Checkout uses saved-address selection or an interactive address form. Recipient name, Indian mobile, street address, landmark, city, state and PIN code are required. A final summary and confirmation button commit the order. Payment remains pay on delivery. Cancellation is allowed only before dispatch, rechecked during confirmation.

Ending a chat shows a farewell and its chat ID. Restore uses the ID plus a fresh email verification challenge tied to the owner and requested conversation. Conversations, carts and pending actions live in Supabase, not a local database, browser storage or server session map. Browser component state and request-scoped objects exist only while displaying/processing data.

The assistant answers shopping-related questions, redirects unrelated requests, and uses UI controls instead of slash commands. It cannot commit an order through a model tool or a conversational “yes”.

## Verification

```powershell
npm test --prefix setup/node
npm run build --prefix setup/node
npm test --prefix chat
npm run build --prefix chat
.\setup\python\.venv\Scripts\python.exe -m pytest setup/python/tests -q
```

Tests use isolated fixtures/mocks unless explicitly marked for remote integration. Real email delivery requires your Resend key and verified sender. Do not use production customer addresses to send test OTPs.

## Live terminal logs

From the repository root run `./start-dev.ps1` to open visible Node, Python and chat terminals. Each logs request method, route, status and duration. Node also reports sanitized Resend acceptance/rejection details. Request bodies, OTPs, credentials and email addresses are not logged. Close/stop an already running service before launching a second instance on its port.

`RESEND_FROM` must include a sender email, for example `Team Veyrix <hello@your-verified-domain>`, not just a display name. After editing `setup/node/.env`, restart the Node terminal with `npm run dev`. The Resend test domain is limited to the account owner's address. API acceptance is not a guarantee of inbox delivery; inspect Resend's delivery status for accepted messages.
