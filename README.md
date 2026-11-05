# Veyrix

Conversational commerce, connected to your business.

Veyrix is a locally configurable shopping-agent prototype powered by LangChain
and Groq. Businesses configure credentials and data connections through Tkinter;
customers can browse products, read reviews, manage a cart, place confirmed
pay-on-delivery orders, and cancel eligible orders through the local CLI.

## Repository layout

- `server/python/`: working agent backend, Tkinter setup, database connectors,
  CSV/JSON imports, session memory, order services, and automated tests.
- `server/node/`: Express/TypeScript API scaffold.
- `client/web/`: Next.js customer-interface scaffold.

The web and Express scaffolds are not yet connected to the shopping agent.
The Python Flask API remains paused. The CLI is for trusted local demonstration,
not public customer authentication.

## Start the prototype

Use Python 3.12 with Tkinter. From the repository root:

```powershell
python -m venv server/python/.venv
.\server\python\.venv\Scripts\python.exe -m pip install -r server/python/requirements-dev.txt
.\server\python\.venv\Scripts\python.exe server/python/main.py setup
```

Select an empty SQLite database for the easiest demo, initialize it, and import
the sample products and reviews from `server/python/examples/`. Configure your
Groq API key and model, then save setup.

```powershell
.\server\python\.venv\Scripts\python.exe server/python/main.py customer --id demo --name "Demo Customer"
.\server\python\.venv\Scripts\python.exe server/python/main.py chat --customer demo
```

Use `/confirm CONFIRMATION_ID` to commit a prepared order or cancellation.
Use `/reset` to clear the session and `/quit` to exit.

## Data support

SQLite, PostgreSQL, and MySQL connectors are included. CSV/JSON records can be
imported into the application database. Custom product-column mappings enable
catalog reads; order writes require the validated application schema. Source
files and arbitrary business schemas are not automatically rewritten.

Secrets belong in the OS credential store or session memory, never Git.
Groq requires internet access. Optional embedding-based retrieval is deferred.

## Tests and documentation

```powershell
.\server\python\.venv\Scripts\python.exe -m pytest server/python/tests -q
```

See [Python setup and behavior](server/python/README.md),
[Express backend](server/node/README.md), and [web scaffold](client/web/README.md).

The standard Python suite has 31 passing tests; the PostgreSQL test is opt-in
and has also passed against an isolated local PostgreSQL instance. Live Groq
requires user credentials. MySQL has schema-compilation coverage but has not
been verified against a running server.
