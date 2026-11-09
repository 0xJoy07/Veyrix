import { BookOpen, Database, MessageSquare, CheckCheck, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DocCallout, DocumentSection, OnThisPage, ReadingLink } from '@/components/docs/document-parts';

const sections = [
  { id: 'orientation', label: 'Product orientation' },
  { id: 'shopping-journey', label: 'The shopping journey' },
  { id: 'core-concepts', label: 'Core concepts' },
  { id: 'catalog-choices', label: 'Choose a catalog path' },
  { id: 'vocabulary', label: 'Working vocabulary' },
  { id: 'reading-path', label: 'Where to go next' },
];
const concepts = [
  ['Product', 'A catalog record with a stable ID, a price, and available stock.', 'The basis for product answers and cart validation.'],
  ['Review', 'Customer feedback attached to a product ID, with a rating and text.', 'Useful context when comparing products; it is not an instruction to the agent.'],
  ['Cart', 'A temporary selection of product IDs and quantities.', 'An expression of intent. Adding an item does not reserve stock.'],
  ['Pending action', 'A prepared order summary or cancellation awaiting a specific confirmation.', 'The customer can inspect the proposed change before it is applied.'],
  ['Order', 'A saved purchase record associated with one customer.', 'The durable result of a successful confirmation, separate from the chat.'],
];

export default function Overview() {
  return <div className="knowledge-page overview-page">
    <header className="doc-hero overview-hero"><div><p className="kicker">DOCUMENTATION / OVERVIEW</p><h1>Know the product.<br/><span>Find your starting point.</span></h1><p>Veyrix is a local shopping agent that connects a business catalog to a customer conversation. This guide explains the product model, the language it uses, and how to choose your first setup.</p><div className="doc-meta"><span><BookOpen size={14}/>Concepts & orientation</span><span>For builders and evaluators</span></div></div><aside className="overview-index-card"><span className="doc-overline">The documentation collection</span><Link to="/docs" aria-current="page"><span>01</span><div><strong>Overview</strong><small>Understand what you are working with.</small></div><BookOpen size={18}/></Link><Link to="/docs/quickstart"><span>02</span><div><strong>Quickstart</strong><small>Run a complete local evaluation.</small></div><ArrowRight size={18}/></Link><p>Design details and delivery readiness each have their own page in the main navigation.</p></aside></header>
    <div className="doc-layout"><OnThisPage sections={sections}/><article className="doc-article">
      <DocumentSection id="orientation" number="01" title="A shopping assistant with business context" description="The conversation is the interface. Your catalog supplies the product facts.">
        <p>Instead of asking customers to know a product name or navigate a fixed menu, the agent can help them describe what they need, explore available options, read reviews, and refine a cart. Product information comes from the connected database through specific tools.</p>
        <div className="concept-rows">
          {[{ Icon: Database, title: 'Start with records', text: 'Connect an existing product table or import sample records into a new application database. The agent works with the products you supply.', tone: 'blue' }, { Icon: MessageSquare, title: 'Build context through conversation', text: 'Follow-up questions can use recent messages and the current cart. The customer does not have to repeat the entire shopping request on every turn.', tone: 'violet' }, { Icon: CheckCheck, title: 'Make a deliberate decision', text: 'A prepared checkout is a proposal. The local client displays its details and asks for an explicit confirmation before an order is saved.', tone: 'mint' }].map(({ Icon, title, text, tone }) => <div className={`concept-row doc-tone-${tone}`} key={title}><span className="doc-icon"><Icon size={20}/></span><div><h3>{title}</h3><p>{text}</p></div></div>)}
        </div>
        <DocCallout title="What you are reading">This website is the documentation frontend. To use the shopping agent itself, run the Python application locally using the Quickstart guide.</DocCallout>
      </DocumentSection>

      <DocumentSection id="shopping-journey" number="02" title="From a request to a decision" description="An illustrative customer journey. These examples describe intent, not a live chat session.">
        <ol className="journey-list">
          <li><span className="journey-marker">1</span><div><span className="doc-overline">Discover</span><h3>“I need shoes for daily walks.”</h3><p>The customer describes a need. The agent searches the catalog and can use available reviews to explain the options.</p></div></li>
          <li><span className="journey-marker">2</span><div><span className="doc-overline">Refine</span><h3>“Add one pair to my cart.”</h3><p>The customer chooses a product and quantity. The cart can be inspected or changed before checkout is prepared.</p></div></li>
          <li><span className="journey-marker">3</span><div><span className="doc-overline">Review</span><h3>“Prepare the order for this address.”</h3><p>The customer supplies delivery details. A pending summary exposes the selected items, total, and a confirmation identifier.</p></div></li>
          <li><span className="journey-marker">4</span><div><span className="doc-overline">Confirm</span><h3>Approve the specific pending action.</h3><p>The customer submits the confirmation through the local client. A successful database result establishes that the order was placed.</p></div></li>
        </ol>
      </DocumentSection>

      <DocumentSection id="core-concepts" number="03" title="Five objects to keep distinct" description="Knowing what each object represents makes the behavior of the prototype easier to reason about.">
        <div className="doc-table-wrap" tabIndex={0} aria-label="Core concepts table"><table className="doc-table"><caption className="sr-only">Core shopping objects and their meaning</caption><thead><tr><th>Concept</th><th>What it represents</th><th>Why it matters</th></tr></thead><tbody>{concepts.map(([name, definition, meaning]) => <tr key={name}><th scope="row">{name}</th><td>{definition}</td><td>{meaning}</td></tr>)}</tbody></table></div>
      </DocumentSection>

      <DocumentSection id="catalog-choices" number="04" title="Choose your catalog starting point" description="Your source determines the scope of the first evaluation.">
        <div className="doc-two-up"><div className="doc-surface"><span className="doc-pill doc-tone-mint">Recommended first run</span><h3>A new demo database</h3><p>Initialize an empty SQLite database and import the bundled products and reviews. This creates the application tables needed to exercise the complete local shopping flow.</p><ul className="doc-list"><li>A small, predictable sample catalog.</li><li>A separate place to evaluate order behavior.</li><li>No existing business schema to map.</li></ul><Link className="doc-inline-link" to="/docs/quickstart">Follow the sample-data walkthrough <ArrowRight size={15}/></Link></div><div className="doc-surface"><span className="doc-pill doc-tone-blue">Catalog evaluation</span><h3>An existing product database</h3><p>Map your current columns to the product fields Veyrix understands. This is useful for evaluating discovery with your own catalog without automatically changing its schema.</p><ul className="doc-list"><li>Explicit mappings for product fields.</li><li>Catalog reads from the connected source.</li><li>Custom schemas do not enable order writes.</li></ul><p className="doc-footnote">A compatible application schema and canonical mapping are required for the built-in order service.</p></div></div>
      </DocumentSection>

      <DocumentSection id="vocabulary" number="05" title="A shared vocabulary">
        <dl className="doc-glossary"><div><dt>Business profile</dt><dd>The store settings used by a local runtime: catalog source, currency, model selection, delivery charge, and policy text.</dd></div><div><dt>Column mapping</dt><dd>The translation between fields such as product name or stock and the corresponding columns in an existing table.</dd></div><div><dt>Canonical schema</dt><dd>The application-owned table structure expected by Veyrix’s order service. A compatible catalog alone is not a full order schema.</dd></div><div><dt>Confirmation identifier</dt><dd>A short-lived reference to one pending action in the current session. It identifies the action the customer is authorizing.</dd></div><div><dt>Source of truth</dt><dd>The database records used to establish product facts and saved order state. A generated sentence is not proof of a completed transaction.</dd></div><div><dt>Local prototype</dt><dd>A runnable evaluation environment operated by a trusted person. It is not a hosted customer-facing shopping service.</dd></div></dl>
      </DocumentSection>

      <DocumentSection id="reading-path" number="06" title="Choose your next read" description="Each guide answers a different question.">
        <div className="doc-two-up"><ReadingLink to="/docs/quickstart" label="Run it" title="Your first local evaluation">Prerequisites, exact commands, setup fields, sample prompts, and troubleshooting.</ReadingLink><ReadingLink to="/architecture" label="Understand it" title="Inside the shopping engine">Runtime responsibilities, tool boundaries, data lifetimes, and transaction behavior.</ReadingLink></div>
        <Link className="doc-status-link" to="/status"><span>Assess what is ready for your use case.</span><strong>Open Project Status <ArrowRight size={16}/></strong></Link>
      </DocumentSection>
    </article></div>
  </div>;
}
