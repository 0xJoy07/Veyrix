# Veyrix architecture

> A detailed visual guide to the shopping application: how requests move, where memory lives, which service authorizes each action, and how orders are committed.

[Project overview](README.md) · [File-by-file reference](ARCHITECTURE_INDEX.md) · [Commerce setup](setup/node/README.md) · [Agent setup](setup/python/README.md)

The diagrams are separated by responsibility so individual labels remain readable. On GitHub, open a rendered diagram's expanded view to inspect it at a larger size.

## 1. Complete system overview

**Read from top to bottom.** Solid arrows show requests or data access; dotted arrows show returned information or explanatory relationships. The documentation site is independent of customer commerce operations.

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontSize":"18px"},"flowchart":{"nodeSpacing":40,"rankSpacing":65,"curve":"basis"}}}%%
flowchart TB
    USER["CUSTOMER<br/>Browse · ask · review · confirm"]

    subgraph CLIENT["1 — CUSTOMER INTERFACE · chat/ · port 5174"]
        UI["React + TypeScript<br/>Messages, OTP forms, delivery forms<br/>Order and cancellation confirmation buttons"]
        PROXY["Same-origin API proxy<br/>Allowed routes and request-size limits<br/>Forwards the HttpOnly session cookie"]
        UI --> PROXY
    end
    USER --> UI

    subgraph COMMERCE["2 — COMMERCE AUTHORITY · setup/node/ · port 8001"]
        AUTH["Express authentication and validation<br/>Origin checks · expiring session · Zod schemas"]
        CHAT["Conversation coordinator<br/>Check customer ownership and profile<br/>Acquire turn lease · load saved history"]
        TOOLS["Private shopping tools<br/>Validate service key, owner and active turn<br/>Catalog · cart · order lookup · prepare actions"]
        CONFIRM["Confirmation endpoint<br/>Recheck pending token, ownership and expiry<br/>Revalidate prices, stock and order status"]
        ORM["Prisma data access<br/>Bound query values<br/>Serializable transactions for commerce operations"]
        AUTH --> CHAT
        AUTH --> ORM
        AUTH --> CONFIRM
        TOOLS --> ORM
        CONFIRM --> ORM
        CHAT --> ORM
    end
    PROXY -->|"Public /api/* requests"| AUTH

    subgraph AI["3 — PRIVATE AI WORKER · setup/python/ · port 8000 by default"]
        API["Flask /api/respond<br/>Verify SHOPPING_API_KEY<br/>Validate message, identity and history fields"]
        ROUTER["Intent handling<br/>Exact greeting / cart-read shortcuts<br/>Shopping-scope classification for other input"]
        AGENT["LangChain create_agent<br/>System instructions + tool schemas<br/>Bounded model/tool execution"]
        MEMORY["LangGraph InMemorySaver<br/>Fresh checkpoint state for this request<br/>Recent conversation + tool observations"]
        API --> ROUTER
        ROUTER -->|"Shopping request requiring reasoning"| AGENT
        AGENT <--> MEMORY
    end
    CHAT -->|"Verified IDs + turn ID + message + history<br/>Private bearer-authenticated request"| API
    ROUTER -->|"Exact cart read: no model call"| TOOLS
    AGENT -->|"Authenticated /internal/tools<br/>Identity supplied by server context"| TOOLS
    TOOLS -.->|"Validated results; secrets stripped before model use"| AGENT

    GROQ["GROQ MODEL PROVIDER<br/>ChatGroq · configured tool-capable model<br/>Scope classification and agent inference"]
    ROUTER <-->|"Scope classification when required"| GROQ
    AGENT <-->|"Model messages and tool-call decisions"| GROQ

    subgraph STORAGE["4 — SUPABASE POSTGRESQL · DURABLE SOURCE OF TRUTH"]
        CATALOG[("Live products and reviews<br/>Source tables exposed through SQL views")]
        STATE[("Customers and conversations<br/>Messages · cart · pending review · turn lease")]
        SECURITY[("OTP challenges and auth sessions<br/>Hashes · expiry · attempts")]
        ORDERS[("Saved addresses and orders<br/>Order items · delivery snapshots · events")]
    end
    ORM --> CATALOG
    ORM --> STATE
    ORM --> SECURITY
    ORM --> ORDERS

    EMAIL["RESEND<br/>Deliver verification email<br/>No OTP values in model context"]
    AUTH -->|"Authentication routes create email challenges"| EMAIL
    EMAIL -.->|"OTP email"| USER
    API -.->|"Sanitized final answer / optional checkout action"| CHAT
    CHAT -.->|"Fixed progress events, then final result<br/>Final result only after transcript persistence"| PROXY
    PROXY -.->|"Saved answer and UI state"| UI

    DOCS["DOCUMENTATION WEBSITE · web/<br/>React + Vite · architecture and setup guides<br/>Separate from customer data and authorization"]

    classDef interface fill:#eef2ff,stroke:#6366b0,color:#172033,stroke-width:2px;
    classDef authority fill:#e9f7ef,stroke:#36845a,color:#173824,stroke-width:2px;
    classDef intelligence fill:#f0ebff,stroke:#8264bd,color:#302046,stroke-width:2px;
    classDef storage fill:#e8f3fb,stroke:#427da3,color:#18384b,stroke-width:2px;
    classDef external fill:#fff4e6,stroke:#ad7c34,color:#4d351a,stroke-width:2px;
    class USER,UI,PROXY,DOCS interface;
    class AUTH,CHAT,TOOLS,CONFIRM,ORM authority;
    class API,ROUTER,AGENT,MEMORY intelligence;
    class CATALOG,STATE,SECURITY,ORDERS storage;
    class GROQ,EMAIL external;
```

**The central boundary:** the agent proposes tool calls; Node validates and executes them. The model has no arbitrary SQL tool, no direct database connection, and no tool that commits an order or cancellation.

Python's port is configurable through `SHOPPING_PORT`; this workspace may use `8002`. Node's `PYTHON_API_URL` must match. The documentation site normally runs on `5173`.

## 2. One conversation turn, step by step

This sequence shows a request that uses the agent. Exact greetings and simple cart reads follow the shorter paths in the next diagram.

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontSize":"17px"},"sequence":{"actorMargin":50,"messageMargin":40,"noteMargin":20}}}%%
sequenceDiagram
    autonumber
    actor Customer
    participant Chat as React chat + proxy
    participant Node as Node commerce API
    participant DB as Supabase
    participant Python as Python worker
    participant LLM as Groq

    Customer->>Chat: Send a shopping message
    Chat->>Node: POST /api/chat + session cookie
    Node->>DB: Resolve session, owned chat and customer profile
    Note over Node,DB: Reject expired sessions, ended chats,<br/>incomplete profiles or an active competing turn
    Node->>DB: Acquire a three-minute turn lease
    DB-->>Node: Persisted conversation and current state
    Node-->>Chat: SSE checking / working status
    Node->>Python: POST /api/respond with verified IDs and history
    Python->>Python: Validate request and bound recent context
    Python->>LLM: Classify shopping relevance
    LLM-->>Python: SHOPPING or OFF_TOPIC

    alt Off-topic or unrecognized classification
        Python-->>Node: Fixed shopping redirect
    else Shopping request
        Python->>Python: Create agent and fresh checkpoint memory
        loop Up to six agent model calls and ten tool calls
            Python->>LLM: System instructions + messages + tool definitions
            LLM-->>Python: Final answer or structured tool calls
            opt Tools requested
                Python->>Node: POST /internal/tools + service key + active turn
                Node->>DB: Verify owner, active lease and unexpired authorization
                Node->>DB: Execute allowed catalog/cart/order operation
                DB-->>Node: Live result or persisted change
                Node-->>Python: Tool result
                Python->>Python: Remove private fields; compact valid JSON<br/>Append observation to checkpointed message state
            end
        end
        Python->>Python: Filter final answer and delete temporary checkpoints
        Python-->>Node: Answer and optional checkout action
    end

    Node-->>Chat: SSE saving status
    Node->>DB: Recheck lease; append user/assistant messages<br/>Clear lease in the same committed update
    DB-->>Node: Save confirmed
    Node-->>Chat: Final result + current pending UI state
    Chat-->>Customer: Display saved answer and relevant controls
    Note over Customer,Node: Progress is streamed; raw model tokens are not.<br/>A conversation reply cannot confirm a purchase.
```

If the request fails after dispatch, a cart tool may already have changed state. Node reports `request_outcome_unknown`; the interface hides Retry and asks the customer to reload and check the cart. Disconnecting the browser does not automatically replay an operation or interrupt required persistence.

## 3. Agent decisions and memory lifecycle

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontSize":"18px"},"flowchart":{"nodeSpacing":40,"rankSpacing":55}}}%%
flowchart TB
    IN["Verified request arrives<br/>Customer ID · chat ID · active turn ID<br/>Message + recent persisted history"]
    EXACT{"Exact standalone<br/>supported shortcut?"}
    IN --> EXACT
    EXACT -->|"Greeting or thanks"| FIXED["Return fixed shopping response<br/>Zero model calls"]
    EXACT -->|"Cart-view phrase"| READ["Call owned live cart_view tool<br/>Validate and format returned cart facts<br/>Zero model calls"]
    EXACT -->|"No: includes extra text or other intent"| SCOPE["Shopping-scope classifier<br/>Up to six recent messages / 6,000 characters<br/>Model-aware completion budget"]
    SCOPE --> ALLOWED{"Exact SHOPPING<br/>classification?"}
    ALLOWED -->|"No"| REDIRECT["Return fixed redirect<br/>Do not dispatch shopping tools"]
    ALLOWED -->|"Yes"| CONTEXT["Build bounded agent history<br/>Up to 20 messages / 24,000 characters total<br/>At most 4,000 characters per message"]
    CONTEXT --> CREATE["Create LangChain agent<br/>Fresh LangGraph InMemorySaver<br/>Thread ID from verified chat ID"]
    CREATE --> MODEL["Invoke configured Groq model<br/>Instructions + conversation + tool observations"]
    MODEL --> DECISION{"Tool calls<br/>or final answer?"}
    DECISION -->|"Tool calls"| EXEC["Execute tools sequentially<br/>Node enforces identity and turn ownership<br/>Limit: ten tool calls per agent run"]
    EXEC --> OBS["Strip secret fields<br/>Compact valid tool JSON to 16,000 characters<br/>Mark omitted items/text as truncated"]
    OBS --> CHECKPOINT["Update checkpointed message state<br/>Model reply + matching ToolMessage results"]
    CHECKPOINT --> MODEL
    DECISION -->|"Final answer"| CLEAN["Sanitize final text<br/>Return optional checkout-form action"]
    MODEL -.->|"Six model-call limit reached"| LIMIT["Return a request-to-narrow message"]
    EXEC -.->|"Tool limit reached"| LIMIT
    CLEAN --> DELETE["Delete this request's checkpoints<br/>Also clean up if execution fails"]
    LIMIT --> DELETE
    DELETE --> OUT["Node persists the final conversation<br/>Next request hydrates from Supabase again"]
    FIXED --> OUT
    READ --> OUT
    REDIRECT --> OUT

    classDef decision fill:#fff4e6,stroke:#ad7c34,color:#4d351a,stroke-width:2px;
    classDef memory fill:#f0ebff,stroke:#8264bd,color:#302046,stroke-width:2px;
    classDef safe fill:#e9f7ef,stroke:#36845a,color:#173824,stroke-width:2px;
    class EXACT,ALLOWED,DECISION decision;
    class CONTEXT,CREATE,CHECKPOINT,DELETE memory;
    class FIXED,READ,REDIRECT,CLEAN,OUT safe;
```

### Memory is split deliberately

| Memory / state | Owner | Lifetime | What it contains |
| --- | --- | --- | --- |
| Full conversation | Node + Supabase | Durable until explicitly deleted | Saved user and assistant messages |
| Agent working state | LangGraph `InMemorySaver` | One Python request | Bounded history, model responses, tool observations |
| Shopping state | Node + Supabase | Durable | Cart, pending review, saved addresses, orders |
| Authentication | Node + Supabase | Expiring | Session-token hashes, OTP-challenge hashes, attempts and expiry |
| Browser display state | React | Current browser experience | Rendered messages, open forms, progress and pending controls |

If agent execution raises an error, its checkpoints are still deleted, but Node does not append a successful user/assistant transcript pair. A limit response is a normal returned answer and can be saved.

There is **no vector store, automatic long-term preference learning, or persistent Python customer-session cache**. A new request reconstructs context from the verified saved conversation. Full transcripts are preserved even when the model's input is shortened.

## 4. Checkout and cancellation: explicit write boundaries

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontSize":"17px"},"sequence":{"actorMargin":55,"messageMargin":40}}}%%
sequenceDiagram
    autonumber
    actor Customer
    participant UI as Shopping interface
    participant Agent as AI agent
    participant Node as Commerce authority
    participant DB as Supabase transaction

    Customer->>UI: Ask to check out in chat
    UI->>Node: POST /api/chat + session cookie
    Node->>Agent: Verified request through Python worker
    Agent->>Node: prepare_order tool
    Node-->>Agent: Checkout-form action
    Agent-->>Node: Answer + checkout action
    Node->>DB: Persist chat reply and release turn lease
    Node-->>UI: Checkout action through saved chat response
    UI-->>Customer: Show saved-address selector / delivery form
    Customer->>UI: Choose or save a delivery address
    UI->>Node: POST /api/checkout/prepare
    Node->>DB: Verify owned chat and address; read live items
    Node->>DB: Save item, price and delivery snapshot<br/>Pending confirmation expires in five minutes
    Node-->>UI: Review summary + confirmation control

    Note over Agent,DB: Preparation does not reserve inventory.<br/>The agent has no commit tool.

    Customer->>UI: Click Confirm order
    UI->>Node: POST /api/chat/confirm + confirmation ID
    Node->>DB: Begin serializable transaction
    Node->>DB: Verify ownership and pending-token expiry<br/>Recheck cart, prices, stock and delivery charges
    alt Details changed or stock is insufficient
        DB-->>Node: Reject / roll back
        Node-->>UI: Request a fresh review
    else Review remains valid
        Node->>DB: Conditionally reduce stock<br/>Create order, items and event<br/>Save answer; clear cart and pending state
        DB-->>Node: Commit
        Node-->>UI: Confirmed pay-on-delivery order
    end

    opt Customer later requests cancellation
        UI->>Node: Prepare owned-order cancellation
        Node->>DB: Check pre-dispatch eligibility; save pending review
        Node-->>UI: Cancellation confirmation control
        Customer->>UI: Click Confirm cancellation
        UI->>Node: Confirm pending cancellation
        Node->>DB: Recheck ownership, token and current status<br/>Cancel, restore stock, record event atomically
        Node-->>UI: Persisted cancellation outcome
    end
    Note over Node,DB: Repeated successful confirmations return the existing outcome.<br/>They must not repeat order creation or stock restoration.
```

## 5. Data and trust boundaries

| Boundary | Required checks / responsibilities |
| --- | --- |
| Browser → chat proxy | Supported routes, same-origin policy, body-size limits; no backend credentials injected into client code |
| Protected browser API → Node | HttpOnly cookie, valid unexpired session, request schemas, owned records; authentication start/verify routes instead validate the OTP flow before issuing a session |
| Node → Python | `SHOPPING_API_KEY`; verified customer/chat/turn identifiers supplied by Node |
| Python → Node tools | `INTERNAL_API_KEY`; active turn lease, customer ownership, unexpired verified session |
| Node → database | Prisma-bound data values, schema-identifier validation, transactional commerce writes |
| Model/tool data → UI | Private fields removed from model observations; final text filtering; explicit confirmation controls |
| Database → future requests | Owned transcript retrieval; fresh verification for saved-chat restoration |

### Persisted records

| Tables / views | Responsibility |
| --- | --- |
| `customers` | Customer identity and verified contact association |
| `veyrix_auth_sessions`, `veyrix_otp_challenges` | Session hashes, OTP hashes, expiry and attempt tracking |
| `veyrix_chats` | Transcript JSON, cart, pending action, status and turn lease |
| `veyrix_addresses` | Customer-owned saved delivery details |
| `live_products`, `live_reviews` | Views over the authoritative public catalog; no copied catalog cache |
| `orders`, `order_items`, `order_events` | Durable purchase snapshots, line items and order lifecycle events |

OTP validity is **10 minutes**, verified-session validity **30 minutes**, pending confirmation validity **5 minutes**, and the chat turn lease **3 minutes**. Session expiry and ending a chat do not erase its stored transcript. Automated retention/deletion is not enabled.

## 6. From the diagrams to the code

| Diagram responsibility | Main implementation |
| --- | --- |
| Shopping interface and forms | [`chat/src/App.tsx`](chat/src/App.tsx), [`commerce-cards.tsx`](chat/src/components/commerce-cards.tsx) |
| Same-origin proxy | [`chat/server/api.mjs`](chat/server/api.mjs) |
| Browser API and progress responses | [`app.ts`](setup/node/src/app.ts), [`chat-stream.ts`](setup/node/src/chat-stream.ts) |
| Verification and sessions | [`auth.ts`](setup/node/src/auth.ts), [`security.ts`](setup/node/src/security.ts) |
| Tool execution and checkout | [`commerce.ts`](setup/node/src/commerce.ts) |
| Transactions and database models | [`store.ts`](setup/node/src/store.ts), [`schema.prisma`](setup/node/prisma/schema.prisma) |
| Private Python request contract | [`api/stateless.py`](setup/python/api/stateless.py) |
| Agent, shortcuts and temporary memory | [`agent/stateless.py`](setup/python/agent/stateless.py) |
| Model and reasoning settings | [`agent/llm_client.py`](setup/python/agent/llm_client.py) |
| Documentation diagrams in the website | [`Architecture.tsx`](web/src/pages/Architecture.tsx), [`ai-agent-pipeline.tsx`](web/src/components/ui/ai-agent-pipeline.tsx) |

For the complete inventory, dependencies, administrative utilities and verification commands, see [ARCHITECTURE_INDEX.md](ARCHITECTURE_INDEX.md).
