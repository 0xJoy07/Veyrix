# Veyrix stateless shopping assistant

The Python process is now a private, stateless Groq worker. The TypeScript service
in `../node` owns customer authentication, email verification, chats, carts,
addresses, orders, cancellations and all persistence through Prisma/Supabase.
The running Python server does not create a local database, transcript, customer
cache or persistent Python session store. LangChain checkpoint memory exists only while processing
a request. No OTP or API key belongs in model messages.

## Agent and conversation memory

`agent/stateless.py` creates the agent with `langchain.agents.create_agent`.
LangChain runs the model/tool loop; `ChatGroq` supplies the model and `@tool`
functions call the existing authenticated Node commerce service. Middleware
limits each agent run to six model calls and ten tool calls. Tools run serially
(`max_concurrency=1`) so cart mutations retain their requested order. A separate
scope-classification model call happens before
agent creation for general requests. Known non-reasoning Llama 3.1 8B and Llama 3.3
70B models use an eight-token completion budget. GPT-OSS models use 512 tokens
and low reasoning effort; unknown models use a conservative 512-token budget
without unsupported reasoning parameters. GPT-OSS agent calls also default to
low effort; `GROQ_REASONING_EFFORT=low|medium|high` optionally overrides the agent
setting only for GPT-OSS 20B/120B. Other models reject this override. Scope calls
always keep low effort; the main agent retains its 1,500-token output budget.
Exact standalone greetings/thanks use a
fixed reply; exact cart-read phrases fetch the authenticated live cart and format
its validated facts without a model call. Additional text, identity changes,
SQL-like suffixes, and all mutations use the normal scope/agent path.

The agent receives at most 20 historical messages, 4,000 characters per message
and 24,000 characters in total. Scope classification receives at most six recent
messages and 6,000 characters. Full transcripts remain unchanged in Supabase.
Tool observations are compact valid JSON bounded to 16,000 characters; oversized
prose/items are explicitly marked partial, while retained IDs and numeric facts
are preserved. The assistant logs only fixed stage names and elapsed milliseconds,
never customer IDs, prompts, tool results, or secrets. An optional progress callback
emits only `checking`, `thinking`, `tools`, and `finishing` for a streaming adapter.

Short-term memory uses LangGraph `InMemorySaver`, keyed by the verified chat ID
and scoped to one HTTP request. Node supplies the persisted conversation; the
latest 20 messages hydrate the agent state. Checkpoints retain messages and tool
results between graph steps and are deleted in `finally`, including on failure.
Supabase remains the durable conversation store and restores context after
restarts. This is not a persistent Python checkpoint database or a cross-chat
preference memory. Full transcripts remain in Supabase; only bounded recent
context reaches the model.

The obsolete custom agent loop, RAM session store, local tool wrappers and
injected legacy HTTP adapter have been removed. Explicit SQL administration
commands (`check`, `init-db`, `import`, `customer`) remain separate from the
running worker and must not be used to provision the current Supabase app.

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

The worker tests execute the real LangChain graph with a deterministic chat model and mocked commerce calls, including an actual loopback HTTP request. The legacy
SQLAlchemy/admin modules remain for isolated compatibility tests and explicit
administrative import utilities; they are not loaded as a runtime store by the
new HTTP startup. Do not run legacy `init-db`, imports or customer-registration
commands for the new Supabase service. No existing local data is automatically
deleted or migrated.
