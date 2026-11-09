import { useState } from 'react';
import { Check, TerminalSquare, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Code } from '@/components/code-block';
import { Disclosure, DocCallout, DocumentSection, OnThisPage } from '@/components/docs/document-parts';

const setup = String.raw`python -m venv main_setup/python/.venv
.\main_setup\python\.venv\Scripts\python.exe -m pip install -r main_setup/python/requirements-dev.txt
.\main_setup\python\.venv\Scripts\python.exe main_setup/python/main.py setup`;
const chat = String.raw`.\main_setup\python\.venv\Scripts\python.exe main_setup/python/main.py customer --id demo --name "Demo Customer"
.\main_setup\python\.venv\Scripts\python.exe main_setup/python/main.py chat --customer demo`;
const verify = String.raw`.\main_setup\python\.venv\Scripts\python.exe -m pytest main_setup/python/tests -q`;
const sections = [
  { id: 'prerequisites', label: 'Before you start' },
  { id: 'install', label: 'Install the environment' },
  { id: 'configure', label: 'Configure the store' },
  { id: 'first-chat', label: 'Run a conversation' },
  { id: 'verify', label: 'Check your result' },
  { id: 'troubleshooting', label: 'Troubleshooting' },
];
const prerequisites = [
  { title: 'Python 3.12 with Tkinter', text: 'Install Python with Tk support so the business setup window can open.' },
  { title: 'The project open in PowerShell', text: 'Use the repository root: the directory containing both main_setup and web.' },
  { title: 'A Groq API key and a tool-capable model', text: 'The live conversation requires a working internet connection and provider access.' },
  { title: 'An empty database for this demo', text: 'Choose a new SQLite file. The setup tool initializes only empty databases.' },
];

export default function Quickstart() {
  const [checked, setChecked] = useState<string[]>([]);
  return <div className="knowledge-page quickstart-page">
    <header className="doc-hero"><p className="kicker">DOCUMENTATION / QUICKSTART</p><h1>Your first conversation.<br/><span>From a clean local setup.</span></h1><p>Set up a sample store, start the shopping agent, and complete an explicitly confirmed order. This walkthrough uses Windows PowerShell and the bundled SQLite sample catalog.</p><div className="doc-meta"><span><TerminalSquare size={14}/>Windows · PowerShell</span><span>Python 3.12</span><span>Sample data included</span></div></header>
    <div className="doc-layout"><OnThisPage sections={sections}/><article className="doc-article">
      <DocumentSection id="prerequisites" number="00" title="Prepare your workspace" description="Use this checklist to keep track of your setup. Checks are personal reminders for this visit, not automatic environment detection.">
        <div className="prerequisite-list">{prerequisites.map(item => <label key={item.title}><input type="checkbox" checked={checked.includes(item.title)} onChange={event => setChecked(current => event.target.checked ? [...current, item.title] : current.filter(title => title !== item.title))}/><span className="prerequisite-check" aria-hidden="true"><Check size={14}/></span><span><strong>{item.title}</strong><small>{item.text}</small></span></label>)}<div className="checklist-total" aria-live="polite">{checked.length} of {prerequisites.length} prerequisites checked<span>{checked.length === prerequisites.length ? 'Ready to follow the steps' : 'Check each item when ready'}</span></div></div>
      </DocumentSection>

      <DocumentSection id="install" number="01" title="Create the environment" description="Run the following commands from the repository root, one at a time. The last command opens the desktop setup window.">
        <Code text={setup}/>
        <p className="doc-footnote">Calling the environment’s Python executable directly avoids needing to activate PowerShell scripts. Keep the setup window open for the next step.</p>
        <DocCallout title="Reproducing the validated dependency set">For the exact recorded package versions, use <code>main_setup/python/requirements-lock.txt</code> in the install command instead of <code>requirements-dev.txt</code>.</DocCallout>
      </DocumentSection>

      <DocumentSection id="configure" number="02" title="Give the store a catalog" description="Complete these actions in the business setup window. Begin with the bundled records before trying your own mappings.">
        <ol className="setup-actions">
          <li><strong>Initialize the database.</strong><p>Choose SQLite, select a new database file, and click <em>Initialize empty database</em>. The application creates its product, customer, and order tables.</p></li>
          <li><strong>Preview and import products.</strong><p>Import <code>main_setup/python/examples/products.csv</code>. To add feedback, switch <em>Record type</em> to <em>reviews</em>, then import <code>main_setup/python/examples/reviews.csv</code>.</p></li>
          <li><strong>Configure the model.</strong><p>Enter your Groq API key and a tool-capable model ID available to your account. Use <em>Test Groq</em> to check the credentials and connection.</p></li>
          <li><strong>Validate and save.</strong><p>Review the store settings, test the database connection, and save the profile. Close the setup window before continuing in PowerShell.</p></li>
        </ol>
        <div className="doc-table-wrap" tabIndex={0} aria-label="Store configuration reference"><table className="doc-table"><caption>Settings to review for the sample store</caption><thead><tr><th>Setting</th><th>First-run choice</th><th>Effect</th></tr></thead><tbody>
          <tr><th scope="row">Store name</th><td>A recognizable demo name</td><td>Identifies the business in the agent’s context.</td></tr>
          <tr><th scope="row">Currency</th><td>INR for the bundled example</td><td>One currency per store; amounts use two decimal places.</td></tr>
          <tr><th scope="row">Delivery charge</th><td>0 for a simple first run</td><td>Added to the checkout total; stored in minor currency units.</td></tr>
          <tr><th scope="row">Product mapping</th><td>Product table: <code>products</code><br/>Catalog mapping JSON: <code>{'{}'}</code></td><td>Leave the mapping empty to keep the canonical order path available.</td></tr>
          <tr><th scope="row">Remember credentials</th><td>Optional</td><td>Uses the OS keyring when selected. Otherwise the CLI asks again.</td></tr>
        </tbody></table></div>
        <DocCallout title="Expected sample catalog" tone="mint">The CSV adds <strong>Walking Shoes</strong> (<code>shoe-01</code>, 1,299.00, stock 10) and <strong>Canvas Bag</strong> (<code>bag-01</code>, 499.00, stock 5). Import a file once: duplicate IDs reject the whole import rather than overwriting stock.</DocCallout>
        <p className="doc-footnote">Non-secret settings are saved in <code>main_setup/python/state/config.json</code>. Credentials are handled separately.</p>
      </DocumentSection>

      <DocumentSection id="first-chat" number="03" title="Start the local customer session" description="Register a demo identity, then open the CLI conversation. Customer selection here is a trusted local test facility.">
        <Code text={chat}/>
        <h3 className="doc-subheading">Try this sequence in the chat</h3>
        <div className="prompt-sequence"><div><span>01 / DISCOVER</span><q>Show me the walking shoes and their reviews.</q></div><div><span>02 / ADD</span><q>Add one Walking Shoes item to my cart.</q></div><div><span>03 / PREPARE</span><q>Prepare checkout for Demo Customer, 10 Test Street, Test City.</q></div></div>
        <p>The CLI prints a pending action separately from the agent’s message. Inspect its items, quantity, address, and total. Enter <code>/confirm CONFIRMATION_ID</code>, replacing the placeholder with the actual identifier from that pending action.</p>
        <DocCallout title="Use the confirmation from this session" tone="violet">An ordinary “yes” does not place an order. The confirmation expires after five minutes. If it has expired, ask the agent to prepare checkout again and review the new summary.</DocCallout>
        <div className="doc-table-wrap" tabIndex={0} aria-label="Local chat commands"><table className="doc-table"><caption>Commands entered at the chat prompt, not in PowerShell</caption><thead><tr><th>Command</th><th>What it does</th></tr></thead><tbody><tr><th scope="row"><code>/confirm CONFIRMATION_ID</code></th><td>Applies the pending order or cancellation associated with that identifier.</td></tr><tr><th scope="row"><code>/reset</code></th><td>Starts a fresh session and clears its temporary conversation, cart, and pending action.</td></tr><tr><th scope="row"><code>/quit</code></th><td>Closes the conversation and returns to your shell.</td></tr></tbody></table></div>
      </DocumentSection>

      <DocumentSection id="verify" number="04" title="Check the outcome" description="Use the returned data to confirm the demo behaved as expected.">
        <div className="verification-checks"><div><Check size={17}/><p><strong>Order result:</strong> a successful confirmation returns an order result from the database. Do not treat an agent’s proposed summary as a saved order.</p></div><div><Check size={17}/><p><strong>Catalog stock:</strong> after buying one pair from the fresh sample catalog, Walking Shoes should have 9 units remaining.</p></div><div><Check size={17}/><p><strong>Order history:</strong> ask to view your orders. Resetting the chat clears temporary context but does not delete the saved purchase.</p></div></div>
        <h3 className="doc-subheading">Run the automated checks</h3><p>The default suite uses isolated SQLite databases and a mock model. It does not require a Groq key. The separate PostgreSQL integration test is opt-in and is normally skipped.</p><Code text={verify}/>
        <Link to="/status" className="doc-inline-link">See the verification coverage and remaining gaps <ArrowRight size={15}/></Link>
      </DocumentSection>

      <DocumentSection id="troubleshooting" number="05" title="Resolve common setup issues" description="Start with the specific stage that failed.">
        <div className="doc-accordion-group">
          <Disclosure title="Python or the setup window does not start"><p>Confirm that <code>python</code> resolves to Python 3.12 and that Tkinter is installed. If Windows opens the Store instead, check the Python installation and execution alias. Run the commands from the repository root so the <code>main_setup/python</code> paths resolve correctly.</p></Disclosure>
          <Disclosure title="The database cannot be initialized"><p>Initialization is designed for an empty database. Choose a new file for the demo. For an existing Veyrix database, validate its schema instead of trying to initialize it again.</p></Disclosure>
          <Disclosure title="An import is rejected"><p>Preview the file and check its field mappings. CSV must be comma-delimited UTF-8; JSON must be an array of records. Files must be no larger than 10 MB. Duplicate IDs, including IDs already in the database, reject the entire import. Import products before their reviews.</p></Disclosure>
          <Disclosure title="The chat provider is unavailable"><p>Reopen setup and test Groq with your chosen model and credentials. Check internet access, account limits, and that the model supports tools. If credentials were not saved in the OS keyring, provide them when the CLI asks.</p></Disclosure>
          <Disclosure title="The CLI reports an unknown customer"><p>Run the customer registration command after saving the store setup, then start chat with the same ID. Make sure both commands use the same configuration and database.</p></Disclosure>
          <Disclosure title="Checkout is unavailable or confirmation fails"><p>Custom product mappings support catalog reads; the built-in checkout requires a validated application schema and canonical product mapping. For an expired token or changed product, prepare a new summary. For insufficient stock, reduce the quantity and try again.</p></Disclosure>
        </div>
      </DocumentSection>
      <div className="doc-bottom-nav"><Link to="/docs">Back to Overview</Link><Link to="/architecture">Explore the Architecture <ArrowRight size={16}/></Link></div>
    </article></div>
  </div>;
}
