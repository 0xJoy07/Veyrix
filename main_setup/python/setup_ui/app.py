"""Local administrator setup. All Tk calls remain on the UI thread."""
import json
import queue
import threading
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from config import Config
from security.credential_store import CredentialStore
from setup_ui.controller import test_database, initialize_database, import_file
from db.importers.files import read_file

class SetupApp:
    def __init__(self, root):
        self.root, self.events = root, queue.Queue()
        self.busy = False
        self.secrets = CredentialStore()
        root.title('Shopping Agent — Business Setup')
        root.geometry('920x820')
        self.fields = {}
        try:
            self.config = Config.load()
        except (ValueError, FileNotFoundError, TypeError):
            self.config = Config()
        self.secrets = CredentialStore(self.config.profile)
        notebook = ttk.Notebook(root)
        notebook.pack(fill='both', expand=True, padx=12, pady=12)
        business, database, imports = [ttk.Frame(notebook, padding=12) for _ in range(3)]
        for title, frame in [('Business and Groq', business), ('Database connection', database), ('Import products and reviews', imports)]:
            notebook.add(frame, text=title)
            frame.columnconfigure(1, weight=1)
        self.field(business, 'store_name', 'Store name', self.config.store_name)
        self.field(business, 'currency', 'Currency (three letters)', self.config.currency)
        self.field(business, 'delivery_minor', 'Delivery charge (minor units)', self.config.delivery_minor)
        self.field(business, 'policy', 'Store policy (cancellation before dispatch)', self.config.policy)
        self.field(business, 'session_seconds', 'Session timeout (seconds)', self.config.session_seconds)
        self.field(business, 'model', 'Groq tool-capable model ID', self.config.model)
        self.field(business, 'groq_api_key', 'Groq API key', self.secrets.get('groq_api_key'), secret=True)
        self.persist = tk.BooleanVar(value=False)
        ttk.Checkbutton(business, text='Remember credentials in the OS credential store', variable=self.persist).grid(row=8, column=0, columnspan=2, sticky='w', pady=8)
        ttk.Button(business, text='Test Groq', command=self.test_groq).grid(row=9, column=0, sticky='w')
        ttk.Label(business, text='Pay on delivery only. No payment gateway credentials are needed.\nSession-only secrets must be re-entered after closing setup.\nGroq requires internet access.', wraplength=700).grid(row=10, column=0, columnspan=2, sticky='w', pady=12)

        self.field(database, 'source', 'Database engine', self.config.source, choices=('sqlite', 'postgresql', 'mysql'))
        self.field(database, 'database', 'Database name / SQLite file', self.config.database)
        ttk.Button(database, text='Choose SQLite file', command=self.choose_db).grid(row=2, column=2, padx=4)
        self.field(database, 'host', 'Server host', self.config.host)
        self.field(database, 'port', 'Server port (PostgreSQL 5432 / MySQL 3306)', self.config.port)
        self.field(database, 'username', 'Database username', self.config.username)
        self.field(database, 'database_password', 'Database password', self.secrets.get('database_password'), secret=True)
        self.field(database, 'sslmode', 'TLS mode', self.config.sslmode, choices=('require', 'verify-full', 'disable'))
        self.field(database, 'ssl_ca', 'TLS CA certificate path (optional)', self.config.ssl_ca)
        self.field(database, 'product_table', 'Product table', self.config.product_table)
        self.field(database, 'mapping', 'Catalog mapping JSON (empty = standard schema)', json.dumps(self.config.mapping))
        ttk.Label(database, text='Example: {"id":"sku","name":"title","price":"selling_price","stock":"quantity"}\nCustom mappings enable catalog reads only. Initialize only a new, empty database.\nCSV/JSON users: choose a new SQLite file, initialize it, then use the Import tab.', wraplength=750).grid(row=11, column=0, columnspan=3, sticky='w', pady=10)
        buttons = ttk.Frame(database)
        buttons.grid(row=12, column=0, columnspan=3, sticky='w')
        ttk.Button(buttons, text='Test connection and inspect schema', command=self.test_db).pack(side='left', padx=4)
        ttk.Button(buttons, text='Initialize empty database', command=self.initialize).pack(side='left', padx=4)

        self.field(imports, 'import_path', 'CSV / JSON file', '')
        ttk.Button(imports, text='Browse', command=self.choose_import).grid(row=1, column=2)
        self.field(imports, 'import_kind', 'Record type', 'products', choices=('products', 'reviews'))
        self.field(imports, 'import_mapping', 'Import mapping JSON (empty = matching names)', '{}')
        ttk.Label(imports, text='Products: id, name, price or price_minor, stock; optional category, description.\nReviews: id, product_id, rating (1–5), text.\nCSV uses UTF-8 and comma separators. JSON must be an array of records.\nImports reject existing IDs and never overwrite live stock. Source files stay unchanged.', wraplength=740).grid(row=5, column=0, columnspan=3, sticky='w', pady=12)
        ttk.Button(imports, text='Preview first five records', command=self.preview).grid(row=6, column=0)
        ttk.Button(imports, text='Validate and import', command=self.do_import).grid(row=6, column=1, sticky='w')

        ttk.Button(root, text='Validate and save setup', command=self.save).pack(pady=4)
        self.status = ttk.Label(root, text='Ready. Credentials are not included in previews or saved settings.')
        self.status.pack(anchor='w', padx=12)
        self.output = tk.Text(root, height=12, wrap='word', state='disabled')
        self.output.pack(fill='both', padx=12, pady=8)
        root.after(100, self.poll)

    def field(self, frame, key, label, value, secret=False, choices=None):
        row = len(frame.grid_slaves(column=0)) + 1
        variable = tk.StringVar(value=str(value))
        self.fields[key] = variable
        ttk.Label(frame, text=label).grid(row=row, column=0, sticky='w', pady=6, padx=(0, 10))
        widget = ttk.Combobox(frame, textvariable=variable, values=choices, state='readonly') if choices else ttk.Entry(frame, textvariable=variable, show='*' if secret else '')
        widget.grid(row=row, column=1, sticky='ew', pady=6)

    def snapshot(self):
        data = {key: value.get().strip() for key, value in self.fields.items()}
        config = Config(**{key: data[key] for key in ('store_name', 'currency', 'model', 'source', 'database', 'host', 'username', 'sslmode', 'ssl_ca', 'product_table', 'policy')},
            port=int(data['port']), delivery_minor=int(data['delivery_minor']), session_seconds=int(data['session_seconds']),
            mapping=json.loads(data['mapping'] or '{}'), profile=self.config.profile).validate()
        if not isinstance(config.mapping, dict):
            raise ValueError('Mapping must be a JSON object.')
        secrets = CredentialStore(config.profile)
        for key in ('groq_api_key', 'database_password'):
            secrets.set(key, data[key])
        return config, secrets, data

    def start(self, operation):
        if self.busy:
            return
        self.busy = True
        self.status.config(text='Working…')
        def work():
            try:
                self.events.put(('ok', operation()))
            except ValueError as exc:
                self.events.put(('error', str(exc)))
            except Exception:
                self.events.put(('error', 'Operation failed. Check credentials, host, TLS settings, schema, file format, and installed dependencies.'))
        threading.Thread(target=work, daemon=True).start()

    def poll(self):
        try:
            kind, result = self.events.get_nowait()
            self.busy = False
            self.status.config(text='Completed' if kind == 'ok' else 'Needs attention')
            self.output.config(state='normal')
            self.output.delete('1.0', 'end')
            self.output.insert('end', json.dumps(result, indent=2, default=str))
            self.output.config(state='disabled')
        except queue.Empty:
            pass
        self.root.after(100, self.poll)

    def action(self, callback):
        try:
            config, secrets, data = self.snapshot()
            callback(config, secrets, data)
        except (ValueError, TypeError) as exc:
            messagebox.showerror('Invalid setup', str(exc))

    def choose_db(self):
        path = filedialog.asksaveasfilename(defaultextension='.db', filetypes=[('SQLite database', '*.db'), ('All files', '*.*')])
        if path:
            self.fields['database'].set(path)
            self.fields['source'].set('sqlite')

    def choose_import(self):
        path = filedialog.askopenfilename(filetypes=[('Data files', '*.csv *.json')])
        if path:
            self.fields['import_path'].set(path)

    def test_db(self):
        self.action(lambda c, s, d: self.start(lambda: test_database(c, s)))

    def test_groq(self):
        def action(c, s, d):
            def run():
                from agent.llm_client import make_model
                make_model(c, s).invoke('Reply with OK.')
                return {'message': 'Groq responded successfully.'}
            self.start(run)
        self.action(action)

    def initialize(self):
        if messagebox.askyesno('Initialize database', 'Create application tables in the selected empty database? Existing databases will be rejected.'):
            self.action(lambda c, s, d: self.start(lambda: initialize_database(c, s)))

    def preview(self):
        path = self.fields['import_path'].get()
        self.start(lambda: read_file(path)[:5])

    def do_import(self):
        def action(c, s, d):
            mapping = json.loads(d['import_mapping'] or '{}')
            if messagebox.askyesno('Import records', 'Import validated records into the selected application database?'):
                self.start(lambda: import_file(c, s, d['import_path'], mapping, d['import_kind']))
        self.action(action)

    def save(self):
        persist = self.persist.get()
        def action(c, s, d):
            def run():
                result = test_database(c, s)
                if c.product_table not in result['tables']:
                    raise ValueError('Product table missing. Initialize or correct the table setting first.')
                if not c.model or not s.get('groq_api_key'):
                    raise ValueError('Groq model and API key are required.')
                for key in ('groq_api_key', 'database_password'):
                    if s.get(key):
                        s.set(key, s.get(key), persist=persist)
                c.save()
                return {'message': 'Setup saved. Register a demo customer and run main.py chat. Session-only credentials will be requested by the CLI.', 'checkout_enabled': result.get('checkout_enabled', False)}
            self.start(run)
        self.action(action)

def launch():
    root = tk.Tk()
    SetupApp(root)
    root.mainloop()
