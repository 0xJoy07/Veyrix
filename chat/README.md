# Veyrix demo chat

A standalone React + TypeScript shopping chat based on the supplied AI Chat Card.
Tailwind CSS, Motion and Lucide power the responsive interface. Attachments are
intentionally omitted. Shared UI lives in `src/components/ui`, imported with
`@/components/ui`; this keeps the shadcn component convention consistent.

Assistant replies render Markdown (headings, lists, emphasis, tables and code)
before a word-by-word fade reveals the formatted content. The backend still
returns a complete JSON reply; the reveal is a frontend animation. A composing
Thinking Orb appears while the request is pending. Reduced-motion preferences
show replies immediately and use a static thinking indicator.

## Run locally

Use Node.js 22.12 or newer. First configure and start the Python shopping backend
using [its setup guide](../setup/python/README.md). Register the `demo`
customer, or set `DEMO_CUSTOMER_ID` to a customer already in your database.

From `chat`:

```powershell
npm install
npm run dev
```

Open `http://127.0.0.1:5174`. The server automatically reads the existing
`SHOPPING_API_KEY` from `../setup/python/.env`. For overrides, copy
`.env.example` to `.env` and set the key and customer there. Process environment
values take priority; secrets are never included in the browser bundle.
`SHOPPING_BACKEND_URL` defaults to
`http://127.0.0.1:8000`. The browser talks to same-origin `/api` endpoints; the
Node middleware adds the secret bearer key when contacting Flask. Never put the
key in a `VITE_` variable or client code.

## Build and verify

```powershell
npm run build
npm test
npm start
```

The production preview serves the built app and its API bridge together at
`http://127.0.0.1:4173`. `PORT` changes this port. A static-file-only deployment
will not provide the API bridge.

## API wiring

| Browser route | Flask operation |
| --- | --- |
| `GET /api/health` | `GET /health` |
| `POST /api/chat` with `{message}` | `/api/chat`, adding the configured customer or the saved session |
| `POST /api/chat/reset` with `{}` | `/api/sessions/<id>/reset` |
| `POST /api/chat/confirm` with `{confirmation_id}` | `/api/sessions/<id>/confirm` |

An opaque HttpOnly, SameSite cookie identifies each browser's session. Backend
session IDs and the customer identity are managed on the server. The interface
shows the backend's pending order/cancellation summary and requires an explicit
confirmation button before committing it. Sending conversational “yes” alone
does not submit the confirmation endpoint.

This is a loopback-only, single-customer demo, not a public customer login system.
Requests with non-local hosts or cross-origin browser origins are rejected. All
browser sessions use the configured demo customer; their chat state is separate,
but their customer order history belongs to that same account. The adapter and
Python backend both keep sessions in memory. Restarting either may require a new
chat. Browser reloads retain the backend cookie, while visible messages are held
by the frontend. Do not deploy publicly without genuine user authentication,
customer ownership mapping and an appropriate persistent session store.

The bridge tests use a mocked upstream and cover conversation identity, browser
isolation, reset, explicit confirmation, invalid input and sanitized failures.
Live shopping replies require a running backend with valid Groq and database
configuration.
