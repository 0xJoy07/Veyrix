# Veyrix chat

React/TypeScript shopping interface with email verification, saved addresses, interactive checkout and verified chat retrieval.

## Run

Use Node 22.12 or newer. Configure and start the TypeScript commerce backend in `../setup/node` and the stateless assistant in `../setup/python` first.

```powershell
npm install
npm run dev
```

Open http://127.0.0.1:5174. Optional `chat/.env` setting `COMMERCE_API_URL` defaults to `http://127.0.0.1:8001`. The proxy forwards only supported public API routes and the HttpOnly session cookie; it does not store identities, transcripts or sessions, and does not inject a demo customer.

## Experience

- Email/mobile identification, new-customer registration, and six-digit email OTP with expiry and resend.
- Saved-address selection and Indian address form with required landmark.
- Order/cancellation summaries and explicit confirmation buttons; no terminal commands.
- End-chat farewell with copyable chat ID; restoring requires a new verification challenge.
- No localStorage/sessionStorage for conversations or customer details.

Supabase is the source of truth. Reloading reads the verified account and active conversation from the commerce service.

## Build and checks

```powershell
npm test
npm run build
npm start
```

Production preview uses port 4173. Set the commerce backend's `PUBLIC_ORIGIN` to `http://127.0.0.1:4173` when using that preview. Configure secure cookies and an HTTPS origin for a deployed service. The bundled proxy is restricted to loopback hosts for local development.
