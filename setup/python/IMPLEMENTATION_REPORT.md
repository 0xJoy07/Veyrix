# Headless Flask backend implementation report

Verified on 10 November 2026. This report supersedes the earlier Tkinter implementation report.

## Delivered

Three subagents implemented the HTTP server, main.py/session orchestration, and environment configuration/removal of the desktop interface. The chief agent integrated dependencies, prepared the local environment template, reviewed the changes and ran end-to-end checks. No frontend was built or modified.

- `api/flask.py` is a real Flask app with a factory and a Waitress runner. Direct execution, module execution and the main.py entry point are supported.
- HTTP requests go through bearer-key authentication and JSON validation, then to `main.BackendApplication`. A first message creates a session for a registered customer; later messages reuse the returned session ID and server-held history. Shopping data comes from database-backed tools. Clients cannot replace history, product facts or an existing session's customer identity.
- Session operations serialize across threads. Close/reset waits for active work. Expired or unknown sessions return 404 instead of silently starting a new conversation. Provider failures return sanitized HTTP 503 responses.
- All Tkinter source files and GUI-specific tests were removed. There are no Tkinter imports in the backend. Database initialization, imports and customer registration are available through headless commands.
- Environment variables or `main_setup/python/.env` supply settings and credentials. Process environment values override the file. The old GUI configuration and keyring are no longer loaded. Secret values are excluded from logs/reports.
- The ignored local `.env` was created from existing non-secret settings, with a generated server API token. `GROQ_API_KEY` and `SHOPPING_DB_PASSWORD` remain blank for the user to fill. The existing model and database connection settings were carried over. No credentials were copied from past chats.
- Requirements now include Flask, Waitress and python-dotenv. The dependency lock was regenerated for the required packages, without keyring.

## HTTP interface

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /health | Minimal process readiness |
| POST | /api/chat | First or continuing message |
| POST | /api/sessions | Explicit session creation |
| DELETE | /api/sessions/<id> | End session and clear memory |
| POST | /api/sessions/<id>/reset | Clear old session and return a new ID |
| POST | /api/sessions/<id>/confirm | Explicit order/cancellation confirmation |

All `/api/*` requests require `Authorization: Bearer <SHOPPING_API_KEY>`. First chat body: `{"customer_id":"demo","message":"I prefer blue shoes"}`. Continuation: `{"session_id":"<returned-id>","message":"What color?"}`. Response fields are `session_id`, `answer` and `pending`. JSON bodies are limited to 64 KiB and messages to 8,000 characters.

The key authenticates a trusted upstream server; that caller must authenticate its users and associate each session with the right user. Do not put the shared server key in a public frontend. No browser frontend or CORS integration was added.

## Verification

**136 tests passed; 1 optional PostgreSQL test skipped** because local PostgreSQL test binaries were not configured.

Verification included:

- A real loopback HTTP server roundtrip through Waitress, Flask, main.py, session memory and a deterministic model; first message, history-aware follow-up, rejected unauthenticated request, closed-session rejection and shutdown.
- Real headless command subprocesses for initialization, import and customer registration against an isolated temporary database. Reinitializing a populated database was rejected without changing data.
- HTTP payload validation, API authentication, customer isolation, reset/close, confirmation behavior, sanitized provider failures, session concurrency and active-request expiry handling.
- Environment-file precedence, literal password handling, secret-free config and no-GUI import regression.
- Python compilation, dependency consistency and Git whitespace checks all passed.

The test server used local test records and a mocked model. No business records were changed. Live Supabase/Groq connectivity was not exercised because the required credentials are blank. Live MySQL remains unverified.

## Run

1. Fill `GROQ_API_KEY` and `SHOPPING_DB_PASSWORD` in `main_setup/python/.env`; verify the copied settings.
2. From the repository root, run:

```powershell
.\main_setup\python\.venv\Scripts\python.exe main_setup/python/api/flask.py
```

The default listener is `127.0.0.1:8000`. Alternatively, run `main.py`; it starts the same server. Run `main.py check` to validate environment/database/provider settings without serving. See README.md for headless provisioning and request examples.

## Operational limits

The runner uses one process and four threads. Sessions and complete transcripts remain in RAM until reset/close or process shutdown; production multi-process scaling requires a shared store. The latest ten turns are sent directly to the model, with older-message search available through a recall tool. Recall is not guaranteed perfect. Persisted orders remain in the database.

Startup fetches a snapshot capped at 100,000 records per table; larger sources fail explicitly. Live shopping tools still retrieve current database facts. Missing/custom review schemas remain explicitly unsupported. HTTPS termination and end-user authentication belong to the deployment/upstream service.

Waitress was selected for the threaded, single-process deployment supported on Windows, as documented in the [Flask deployment guide](https://flask.palletsprojects.com/en/stable/deploying/waitress/).

## Subsequent live verification and startup fix

Live checks subsequently passed against the configured database and Groq provider: startup preparation, HTTP listener binding, health (200), missing-key rejection (401), first chat (200), same-session follow-up (200) with successful preference recall, session close (200), and closed-session rejection (404). These supersede the earlier note that live connectivity had not been exercised. The local credentials have since been supplied by the user and remain ignored by Git.

Startup now prints flushed, credential-safe progress for each preparation stage and Waitress prints its bound listening address. This distinguishes slow database/provider checks from an idle server waiting for requests. Specific startup guidance covers missing dependencies and socket/port failures.

Postman was opened through Computer Use, but its expired-login dialog prevented requests there. The live results above were verified through direct HTTP requests, not Postman. The backend started for verification was stopped at the user's request.
