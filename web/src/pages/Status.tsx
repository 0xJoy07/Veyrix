import { useId, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, CheckCircle2, ChevronDown, CircleDashed, FlaskConical, Search, ShieldCheck, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Disclosure } from '@/components/docs/document-parts';
import './status.css';

type DeliveryState = 'implemented' | 'validation' | 'planned';
type Domain = 'Shopping' | 'Data' | 'Runtime' | 'Integration' | 'Operations';
type Capability = {
  id: string;
  title: string;
  state: DeliveryState;
  domain: Domain;
  summary: string;
  evidence: string;
  paths: string[];
  boundary: string;
  next: string;
};

const stateLabels: Record<DeliveryState, string> = {
  implemented: 'Implemented',
  validation: 'Needs validation',
  planned: 'Planned',
};
const capabilities: Capability[] = [
  {
    id: 'catalog', title: 'Catalog discovery & product reviews', state: 'implemented', domain: 'Shopping',
    summary: 'The agent can search connected products and retrieve available customer feedback.',
    evidence: 'Catalog and review tool wrappers call SQL repositories. Setup tests cover mapped product reads; mocked agent tests exercise a tool round trip.',
    paths: ['db/catalog_repository.py', 'tools/catalog_tools.py', 'tools/review_tools.py', 'tests/test_agent.py'],
    boundary: 'Retrieval uses structured SQL records. Semantic search and embeddings are not part of this implementation.',
    next: 'Evaluate relevance and response quality against a representative business catalog with a live model.',
  },
  {
    id: 'sessions', title: 'Temporary carts & conversation sessions', state: 'implemented', domain: 'Runtime',
    summary: 'Customer sessions maintain bounded history, a working cart, and pending actions.',
    evidence: 'Memory tests cover session isolation, reset, expiry, and bounded history. Cart validation rejects invalid quantities.',
    paths: ['memory/session_store.py', 'memory/chat_memory.py', 'services/cart_service.py', 'tests/test_memory.py'],
    boundary: 'State lives in one process. Restarting it discards conversations and carts; adding to a cart does not reserve inventory.',
    next: 'Validate expiry and reset behavior in the intended client experience before expanding beyond a local evaluation.',
  },
  {
    id: 'orders', title: 'Explicitly confirmed order transactions', state: 'implemented', domain: 'Shopping',
    summary: 'Checkout requires a customer confirmation and commits order records with stock changes.',
    evidence: 'Tests cover preparation without writes, duplicate confirmation, cross-customer isolation, changed prices, expiry, rollback, and the last-unit race.',
    paths: ['services/order_service.py', 'tests/test_orders.py'],
    boundary: 'The built-in service requires the validated application schema and canonical product mapping. Payment is pay on delivery only.',
    next: 'Carry the same confirmation and transaction tests through a future authenticated transport.',
  },
  {
    id: 'cancellations', title: 'Eligible cancellations & stock restoration', state: 'implemented', domain: 'Shopping',
    summary: 'A customer can confirm cancellation of an eligible order without restoring stock twice.',
    evidence: 'Cancellation tests verify one-time restoration and reject orders that have already reached a dispatched state.',
    paths: ['services/order_service.py', 'tests/test_orders.py'],
    boundary: 'Only confirmed and preparing orders qualify. There is no payment refund workflow or fulfillment operator interface.',
    next: 'Define operator-driven status transitions before connecting a real fulfillment process.',
  },
  {
    id: 'onboarding', title: 'Business setup & file imports', state: 'implemented', domain: 'Data',
    summary: 'Desktop setup configures a store and imports mapped CSV or JSON records.',
    evidence: 'Import tests cover duplicate rejection, invalid-file rollback, custom CSV mappings, and review imports. Configuration tests check that secrets are excluded.',
    paths: ['setup_ui/', 'db/importers/files.py', 'security/credential_store.py', 'tests/test_importers.py', 'tests/test_setup_config.py'],
    boundary: 'Imports are snapshots, not ongoing synchronization. Credential persistence is opt-in through the OS keyring.',
    next: 'Exercise the setup journey with the business’s actual export format and field mappings.',
  },
  {
    id: 'database', title: 'Schema validation & database connections', state: 'implemented', domain: 'Data',
    summary: 'SQLAlchemy adapters connect SQLite, PostgreSQL, and MySQL; writes are gated by schema compatibility.',
    evidence: 'The default suite exercises SQLite and dialect compilation. The backend README records a separate successful PostgreSQL 18 integration run.',
    paths: ['db/connection.py', 'db/db_setup.py', 'tests/test_dialect_contract.py', 'tests/test_postgres_integration.py'],
    boundary: 'Connector code does not imply equal live verification across databases. Live MySQL coverage remains a separate open item.',
    next: 'Repeat transaction tests against the exact database version and connection configuration selected for a deployment.',
  },
  {
    id: 'groq', title: 'Live Groq conversation validation', state: 'validation', domain: 'Runtime',
    summary: 'The model integration is implemented, but a real-key chat evaluation is still outstanding.',
    evidence: 'A mock model covers tool orchestration, provider failures, and the absence of a model confirmation tool. Setup includes a Test Groq action.',
    paths: ['agent/llm_client.py', 'agent/agent.py', 'tests/test_agent.py', 'setup_ui/app.py'],
    boundary: 'Mocked tests do not establish live model quality, latency, availability, or provider-account compatibility.',
    next: 'Run product discovery, cart changes, and checkout preparation with a real key and a tool-capable model; record outcomes.',
  },
  {
    id: 'mysql', title: 'Live MySQL transaction verification', state: 'validation', domain: 'Data',
    summary: 'The connector and schema compilation exist; live server behavior has not been verified.',
    evidence: 'Dialect contract tests compile the canonical schema for MySQL. The backend verification notes explicitly record the missing live server run.',
    paths: ['db/connection.py', 'tests/test_dialect_contract.py', 'README.md'],
    boundary: 'Compilation is not a substitute for runtime transaction, locking, rollback, or connection testing.',
    next: 'Run the order contract suite against an isolated MySQL server with the intended TLS configuration.',
  },
  {
    id: 'api', title: 'Shopping API & application adapter', state: 'planned', domain: 'Integration',
    summary: 'A business application still needs a transport for chat, cart, order history, and confirmation.',
    evidence: 'The Python Flask entry is paused. The Express scaffold exposes a health route, with no shopping runtime integration.',
    paths: ['api/flask.py', '../node/src/routes/health.routes.ts'],
    boundary: 'The documentation website does not call a shopping API. No public shopping endpoints are documented as available.',
    next: 'Define request/response contracts, attach the Python runtime, and verify service errors and confirmation behavior end to end.',
  },
  {
    id: 'auth', title: 'Verified customer authentication', state: 'planned', domain: 'Integration',
    summary: 'Public clients need authenticated identities and ownership checks at the transport boundary.',
    evidence: 'The current CLI deliberately selects a customer for trusted local testing. It is not an authentication system.',
    paths: ['cli.py', 'main.py', 'db/account_repository.py'],
    boundary: 'A submitted customer ID must not become proof of identity in an external application.',
    next: 'Bind a verified account to each session and test rejected cross-customer requests across every exposed operation.',
  },
  {
    id: 'shared-state', title: 'Shared sessions for multiple workers', state: 'planned', domain: 'Runtime',
    summary: 'Multiple application processes need a consistent session, cart, and pending-action store.',
    evidence: 'The runtime creates an in-memory SessionStore owned by one process.',
    paths: ['runtime.py', 'memory/session_store.py'],
    boundary: 'Launching additional workers today would give each worker separate conversation state.',
    next: 'Define shared storage, expiry, atomic pending-action updates, and restart behavior; add concurrent worker tests.',
  },
  {
    id: 'order-adapters', title: 'Business-specific order adapters', state: 'planned', domain: 'Integration',
    summary: 'Writing into arbitrary business order schemas requires an explicit integration layer.',
    evidence: 'Order writes are currently restricted to validated application tables with canonical product mapping.',
    paths: ['services/order_service.py', 'db/db_setup.py'],
    boundary: 'Mapping catalog fields does not automatically map customers, orders, stock transactions, or fulfillment states.',
    next: 'Specify the target schema and transaction rules, then validate an adapter against the same order invariants.',
  },
  {
    id: 'operations', title: 'Fulfillment & deployment operations', state: 'planned', domain: 'Operations',
    summary: 'A hosted service needs operating procedures and a real workflow for managing placed orders.',
    evidence: 'The current runtime and CLI support local evaluation; the backend README lists the fulfillment operator UI as deferred.',
    paths: ['README.md', 'runtime.py'],
    boundary: 'There is no operator dashboard, courier integration, payment gateway, refund flow, or production readiness claim.',
    next: 'Define fulfillment ownership, observability, recovery procedures, deployment configuration, and release acceptance tests.',
  },
  {
    id: 'sync', title: 'Automatic catalog synchronization', state: 'planned', domain: 'Data',
    summary: 'Recurring updates from business exports or external systems need a dedicated synchronization design.',
    evidence: 'The importer performs all-or-nothing inserts and rejects IDs already in the application database.',
    paths: ['db/importers/files.py', 'tests/test_importers.py'],
    boundary: 'Reimporting a file does not update existing products, overwrite live stock, or keep the source file synchronized.',
    next: 'Define update ownership, stock conflict rules, failure recovery, and reconciliation before adding scheduled sync.',
  },
];
const domains: Domain[] = ['Shopping', 'Data', 'Runtime', 'Integration', 'Operations'];
const deliveryStates: DeliveryState[] = ['implemented', 'validation', 'planned'];

function CapabilityRow({ item }: { item: Capability }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <article className="status-capability" data-open={open}>
    <h3><button className="status-capability-trigger" type="button" aria-expanded={open} aria-controls={id} id={`${id}-trigger`} onClick={() => setOpen(!open)}>
      <span className="status-capability-copy"><small>{item.domain}</small><strong>{item.title}</strong><span>{item.summary}</span></span>
      <span className={`delivery-badge delivery-${item.state}`}><i/>{stateLabels[item.state]}</span>
      <ChevronDown className="status-capability-chevron" size={18} aria-hidden="true"/>
    </button></h3>
    <div className="status-capability-panel" id={id} role="region" aria-labelledby={`${id}-trigger`} aria-hidden={!open} inert={!open}><div><div className="status-capability-details">
      <dl><div><dt>Evidence in the repository</dt><dd>{item.evidence}</dd></div><div><dt>Current boundary</dt><dd>{item.boundary}</dd></div><div><dt>Next acceptance check</dt><dd>{item.next}</dd></div></dl>
      <div className="status-evidence-paths"><span>Source references · relative to main_setup/python</span>{item.paths.map(path => <code key={path}>{path}</code>)}</div>
    </div></div></div>
  </article>;
}

export default function Status() {
  const [state, setState] = useState<DeliveryState | 'all'>('all');
  const [domain, setDomain] = useState<Domain | 'all'>('all');
  const [query, setQuery] = useState('');
  const searchInput = useRef<HTMLInputElement>(null);
  const counts = useMemo(() => Object.fromEntries(deliveryStates.map(value => [value, capabilities.filter(item => item.state === value).length])) as Record<DeliveryState, number>, []);
  const results = capabilities.filter(item => (state === 'all' || item.state === state) && (domain === 'all' || item.domain === domain) && [item.title, item.summary, item.evidence, item.boundary, item.domain, ...item.paths].join(' ').toLowerCase().includes(query.trim().toLowerCase()));
  const hasFilters = state !== 'all' || domain !== 'all' || query !== '';
  const reset = () => { setState('all'); setDomain('all'); setQuery(''); };
  return <div className="knowledge-page project-status-page">
    <header className="doc-hero status-hero"><div><p className="kicker">PROJECT STATUS / DELIVERY & EVIDENCE</p><h1>A working core.<br/><span>A visible path forward.</span></h1><p>Assess what is implemented, what still needs live validation, and what must be built before Veyrix can serve an external application.</p><div className="status-snapshot-note"><span/><span>Repository snapshot · reviewed 9 November 2026<br/><small>A documented assessment, not live service monitoring.</small></span></div></div><aside className="status-release-card"><span className="status-eyebrow">Current release posture</span><ShieldCheck size={26}/><strong>Local evaluation</strong><p>The shopping engine can be evaluated through the trusted local CLI.</p><div><span>Public application rollout</span><b>Integration work remains</b></div></aside></header>

    <section className="status-summary" aria-label="Capability counts">{deliveryStates.map((value, index) => {
      const Icon = [CheckCircle2, FlaskConical, CircleDashed][index];
      return <button type="button" key={value} className={`status-summary-card summary-${value}`} aria-pressed={state === value} aria-controls="capability-results" onClick={() => setState(current => current === value ? 'all' : value)}><span><Icon size={18}/>{stateLabels[value]}</span><strong>{counts[value]}</strong><small>{['Built within the local prototype scope', 'Implemented, with live checks outstanding', 'Defined extensions outside the current core'][index]}</small><span className="status-summary-action">{state === value ? 'Clear this filter' : 'Inspect capabilities'}<ArrowRight size={14}/></span></button>;
    })}</section>
    <p className="status-count-note">Counts describe the {capabilities.length} capabilities below. They are not a percentage-complete estimate.</p>

    <section className="status-section" aria-labelledby="capability-title"><div className="status-section-heading"><div><span className="status-eyebrow">01 / Capability register</span><h2 id="capability-title">Inspect the delivery scope.</h2><p>Filter the register, then open a capability for its evidence, current boundary, and next acceptance check.</p></div><span className="status-section-index">{String(capabilities.length).padStart(2, '0')} entries</span></div>
      <div className="status-filter-panel"><div className="status-filter-top"><label className="status-search"><Search size={17} aria-hidden="true"/><span className="sr-only">Search capabilities</span><input ref={searchInput} type="search" placeholder="Search capabilities or evidence…" value={query} onChange={event => setQuery(event.target.value)}/>{query && <button type="button" aria-label="Clear capability search" onClick={() => { setQuery(''); searchInput.current?.focus(); }}><X size={15}/></button>}</label><label className="status-domain"><span>Area</span><select value={domain} onChange={event => setDomain(event.target.value as Domain | 'all')}><option value="all">All areas</option>{domains.map(value => <option key={value}>{value}</option>)}</select></label></div><div className="status-filter-bottom"><div className="status-filter-pills" role="group" aria-label="Filter by delivery state"><button type="button" aria-pressed={state === 'all'} onClick={() => setState('all')}>All states <span>{capabilities.length}</span></button>{deliveryStates.map(value => <button type="button" key={value} aria-pressed={state === value} onClick={() => setState(value)}>{stateLabels[value]} <span>{counts[value]}</span></button>)}</div><button type="button" className="status-reset" disabled={!hasFilters} onClick={reset}>Reset filters</button></div></div>
      <p className="status-results-count" role="status" aria-live="polite">{results.length} of {capabilities.length} capabilities{state !== 'all' ? ` · ${stateLabels[state]}` : ''}{domain !== 'all' ? ` · ${domain}` : ''}</p>
      <div id="capability-results" className="status-capability-list">{results.length ? results.map(item => <CapabilityRow item={item} key={item.id}/>) : <div className="status-empty"><Search size={25}/><h3>No matching capabilities</h3><p>Try another term or clear the filters to return to the full register.</p><button type="button" onClick={reset}>Show all capabilities <ArrowRight size={16}/></button></div>}</div>
    </section>

    <section className="status-section" aria-labelledby="verification-title"><div className="status-section-heading"><div><span className="status-eyebrow">02 / Verification record</span><h2 id="verification-title">Evidence, with its limits.</h2><p>Passing local tests establishes specific behavior. Provider and database coverage are tracked separately.</p></div></div><div className="status-test-result"><span><CheckCircle2 size={23}/><strong>31 passed</strong><span>1 opt-in test skipped</span></span><p>Default Python suite rerun on 9 November 2026 using isolated test data. The PostgreSQL integration test was not enabled for this run.</p></div>
      <div className="status-verification-wrap" tabIndex={0} aria-label="Verification coverage table"><table className="status-verification-table"><caption className="sr-only">Verification coverage and remaining uncertainty</caption><thead><tr><th>Target</th><th>Evidence</th><th>What this does not prove</th></tr></thead><tbody>
        <tr><th scope="row"><span className="verification-dot verified"/>SQLite / core behavior</th><td>Default automated suite: orders, isolation, concurrency, imports, memory, and configuration.</td><td>Production load characteristics or every business data shape.</td></tr>
        <tr><th scope="row"><span className="verification-dot verified"/>Agent orchestration</th><td>Mock-model tests cover a tool round trip, provider failure, and confirmation separation.</td><td>Live Groq model quality, latency, or account availability.</td></tr>
        <tr><th scope="row"><span className="verification-dot recorded"/>PostgreSQL 18</th><td>A prior isolated live integration pass is recorded in the backend README.</td><td>A fresh result for the current environment; the test was skipped in the latest default run.</td></tr>
        <tr><th scope="row"><span className="verification-dot pending"/>MySQL</th><td>Canonical schema compilation is covered by the dialect contract test.</td><td>Live transaction, connection, TLS, or concurrency behavior.</td></tr>
        <tr><th scope="row"><span className="verification-dot pending"/>Live Groq chat</th><td>The integration and setup connection check exist.</td><td>A completed real-key end-to-end shopping conversation.</td></tr>
      </tbody></table></div>
    </section>

    <section className="status-section" aria-labelledby="milestone-title"><div className="status-section-heading"><div><span className="status-eyebrow">03 / Release gates</span><h2 id="milestone-title">What the next milestones require.</h2><p>These are acceptance criteria for future work, not delivery dates or scheduled commitments.</p></div></div><div className="status-milestones">
      <Disclosure title="01 · Complete the external validation matrix" badge={<span className="status-milestone-state">Validation gate</span>} defaultOpen><p>Establish real environment evidence before treating the existing connectors and model path as verified integrations.</p><ul><li><Check size={14}/>Record a live Groq conversation that covers discovery, cart changes, preparation, and explicit confirmation.</li><li><Check size={14}/>Exercise MySQL transaction and rollback behavior against an isolated server.</li><li><Check size={14}/>Rerun PostgreSQL coverage for the selected database version and connection settings.</li></ul></Disclosure>
      <Disclosure title="02 · Connect an authenticated application" badge={<span className="status-milestone-state">Integration gate</span>}><p>Introduce a transport that preserves the runtime’s existing identity and confirmation boundaries.</p><ul><li><Check size={14}/>Define and implement the shopping API contracts with clear error responses.</li><li><Check size={14}/>Bind sessions to verified customers and reject cross-customer requests.</li><li><Check size={14}/>Test confirmation, retries, and failure recovery through the complete client-to-database path.</li></ul></Disclosure>
      <Disclosure title="03 · Prepare a hosted operating model" badge={<span className="status-milestone-state">Operations gate</span>}><p>Define how the service behaves across restarts, multiple workers, and real order handling.</p><ul><li><Check size={14}/>Choose shared session storage and verify concurrent updates and expiry.</li><li><Check size={14}/>Define fulfillment ownership, deployment configuration, observability, and recovery procedures.</li><li><Check size={14}/>Validate business-specific schema adapters and synchronization rules where required.</li></ul></Disclosure>
    </div></section>

    <section className="status-scope-note" aria-labelledby="scope-title"><div><span className="status-eyebrow">Evaluation boundary</span><h2 id="scope-title">Match the scope to the decision.</h2></div><p>Use this release to evaluate the shopping core and its data requirements. Payments remain pay on delivery; carts and chats are temporary; file imports are snapshots. Public authentication, hosted application integration, and operational workflows require further work.</p><Link to="/docs/quickstart">Evaluate the local prototype <ArrowRight size={16}/></Link></section>
  </div>;
}
