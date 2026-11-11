import { REPOSITORY_URL } from '@/content/repository';
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
    "id": "catalog",
    "title": "Live catalog discovery & reviews",
    "state": "implemented",
    "domain": "Shopping",
    "summary": "The assistant queries configured Supabase products and reviews through Prisma.",
    "evidence": "Live catalog reads and price changes were checked with isolated PostgreSQL fixtures.",
    "paths": [
      "setup/node/src/commerce.ts",
      "setup/node/prisma/live-catalog.sql"
    ],
    "boundary": "The website publishes no connected catalog records. Semantic/vector search is not implemented.",
    "next": "Evaluate search relevance against a representative demo catalog."
  },
  {
    "id": "auth",
    "title": "Verified customer onboarding",
    "state": "implemented",
    "domain": "Integration",
    "summary": "Email or Indian mobile identification leads to a six-digit email OTP.",
    "evidence": "Tests cover ten-minute expiry, single use, failed attempts, resend invalidation and account conflicts.",
    "paths": [
      "setup/node/src/auth.ts",
      "setup/node/tests/workflows.test.ts"
    ],
    "boundary": "The Resend test sender only emails the Resend account owner. Other recipients need a verified sender domain.",
    "next": "Validate delivery with the configured sender and the intended recipient domain."
  },
  {
    "id": "addresses",
    "title": "Interactive Indian delivery forms",
    "state": "implemented",
    "domain": "Shopping",
    "summary": "Customers select a saved address or enter a new address with a required landmark.",
    "evidence": "Frontend render checks cover required fields and the complete order review; backend validates phone, PIN and state.",
    "paths": [
      "chat/src/components/commerce-cards.tsx",
      "setup/node/src/security.ts"
    ],
    "boundary": "PIN validation checks format; it does not verify carrier serviceability or geocode an address.",
    "next": "Test real devices, keyboard navigation and delivery eligibility rules."
  },
  {
    "id": "orders",
    "title": "Button-confirmed order transactions",
    "state": "implemented",
    "domain": "Shopping",
    "summary": "Explicit confirmation saves the order, item snapshots and stock changes together.",
    "evidence": "Isolated PostgreSQL tests cover changed prices, concurrent duplicate confirmation and ownership checks.",
    "paths": [
      "setup/node/src/commerce.ts",
      "setup/node/tests/integration.ts"
    ],
    "boundary": "Pay on delivery only. A conversational yes does not place an order.",
    "next": "Repeat acceptance tests for any payment or fulfillment integration."
  },
  {
    "id": "cancellations",
    "title": "Pre-dispatch cancellation",
    "state": "implemented",
    "domain": "Shopping",
    "summary": "A separate review button confirms eligible cancellation and restores stock once.",
    "evidence": "Tests cover duplicate confirmation and dispatch between preview and final confirmation.",
    "paths": [
      "setup/node/src/commerce.ts",
      "setup/node/tests/integration.ts"
    ],
    "boundary": "Only confirmed/preparing orders qualify. No refund or courier-cancellation integration exists.",
    "next": "Define and test operator-driven fulfillment status transitions."
  },
  {
    "id": "chats",
    "title": "Persistent chats & verified restoration",
    "state": "implemented",
    "domain": "Runtime",
    "summary": "Chats, carts and pending actions persist in Supabase; a chat ID supports later retrieval.",
    "evidence": "Real PostgreSQL integration checks owner-only restoration with fresh email verification.",
    "paths": [
      "setup/node/src/app.ts",
      "setup/node/src/store.ts",
      "chat/src/App.tsx"
    ],
    "boundary": "A chat ID is not an access credential. Ended chats are read-only; retention cleanup is not scheduled.",
    "next": "Agree a retention/deletion policy and recovery process."
  },
  {
    "id": "assistant",
    "title": "Stateless shopping assistant",
    "state": "implemented",
    "domain": "Runtime",
    "summary": "Python receives request-scoped context and calls private Node tools.",
    "evidence": "Mock tests cover tool orchestration and scoped context. Live model checks rejected general-knowledge and bypass requests.",
    "paths": [
      "setup/python/agent/stateless.py",
      "setup/python/tests/test_stateless_assistant.py"
    ],
    "boundary": "Model behavior is probabilistic. The checks do not establish broad accuracy, latency or availability targets.",
    "next": "Maintain a representative evaluation set for shopping relevance and grounded answers."
  },
  {
    "id": "logs",
    "title": "Live service logs & delivery errors",
    "state": "implemented",
    "domain": "Operations",
    "summary": "Node, Python and chat terminals report request status and timing.",
    "evidence": "The launcher opens separate service terminals; Resend errors are surfaced without logging OTPs or credentials.",
    "paths": [
      "start-dev.ps1",
      "setup/node/src/email.ts",
      "setup/python/api/stateless.py"
    ],
    "boundary": "Provider acceptance does not guarantee inbox delivery. No hosted monitoring or alerting platform is included.",
    "next": "Add operational monitoring and verified delivery webhooks before rollout."
  },
  {
    "id": "devices",
    "title": "Broader device & accessibility validation",
    "state": "validation",
    "domain": "Integration",
    "summary": "The chat has responsive forms, labeled fields and keyboard-accessible review controls.",
    "evidence": "Component-render checks and production builds pass. Broad real-device browser coverage is not recorded.",
    "paths": [
      "chat/src/components/commerce-cards.test.tsx",
      "chat/src/styles.css"
    ],
    "boundary": "Component checks do not replace browser, assistive-technology or mobile testing.",
    "next": "Run supported browsers, screen readers and mobile viewport acceptance checks."
  },
  {
    "id": "load",
    "title": "Production load & recovery validation",
    "state": "validation",
    "domain": "Operations",
    "summary": "Database transactions and request leases protect the implemented flow.",
    "evidence": "Concurrent confirmation is covered in isolated PostgreSQL integration tests.",
    "paths": [
      "setup/node/src/store.ts",
      "setup/node/tests/integration.ts"
    ],
    "boundary": "A functional prototype test is not a production load, failover or disaster-recovery exercise.",
    "next": "Validate throughput, pool sizing, provider limits, backups and restore procedures."
  },
  {
    "id": "payments",
    "title": "Payments, refunds & fulfillment",
    "state": "planned",
    "domain": "Integration",
    "summary": "Payment gateways, refund flows, courier integration and an operator dashboard are outside the prototype.",
    "evidence": "The implemented checkout explicitly uses pay on delivery.",
    "paths": [
      "setup/node/src/commerce.ts"
    ],
    "boundary": "No claim of automated payment collection, shipment booking or refund support.",
    "next": "Specify integration ownership, transaction boundaries and reconciliation."
  },
  {
    "id": "deployment",
    "title": "Hosted release & retention policy",
    "state": "planned",
    "domain": "Operations",
    "summary": "A production release needs deployment, monitoring, data-retention and operating procedures.",
    "evidence": "Current startup scripts and loopback proxy are intended for local development with cloud data.",
    "paths": [
      "start-dev.ps1",
      "chat/server/api.mjs",
      "setup/node/README.md"
    ],
    "boundary": "This documentation does not claim production readiness or a hosted customer service.",
    "next": "Configure HTTPS, trusted ingress, secure cookies, alerting and retention before rollout."
  }
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
      <div className="status-evidence-paths"><span>Source references · repository-relative</span>{item.paths.map(path => <a key={path} href={`${REPOSITORY_URL}/blob/main/${path}`} target="_blank" rel="noopener noreferrer" aria-label={`${path} on GitHub (opens in a new tab)`}><code>{path}</code></a>)}</div>
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
    <header className="doc-hero status-hero"><div><p className="kicker">PROJECT STATUS / DELIVERY & EVIDENCE</p><h1>A working core.<br/><span>A visible path forward.</span></h1><p>Review the working prototype, its recorded checks, and the remaining work before a hosted release. Examples use fictional demo data; connected customer and catalog records are not published.</p><div className="status-snapshot-note"><span/><span>Repository snapshot · reviewed 11 November 2026<br/><small>A documented assessment, not live service monitoring.</small></span></div></div><aside className="status-release-card"><span className="status-eyebrow">Current release posture</span><ShieldCheck size={26}/><strong>Connected prototype</strong><p>Interactive chat, verified customers and Supabase persistence are implemented.</p><div><span>Public application rollout</span><b>Production validation remains</b></div></aside></header>

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

    <section className="status-section" aria-labelledby="verification-title"><div className="status-section-heading"><div><span className="status-eyebrow">02 / Verification record</span><h2 id="verification-title">Evidence, with its limits.</h2><p>Recorded checks from 11 November 2026. These are development results, not live monitoring or a production guarantee.</p></div></div><div className="status-test-result"><span><CheckCircle2 size={23}/><strong>Prototype checks passed</strong></span><p>Node and chat builds, targeted Python tests, proxy tests, component rendering, and isolated real PostgreSQL flows were verified. Email integration tests use a mock sender.</p></div><div className="status-verification-wrap" tabIndex={0} aria-label="Verification coverage table"><table className="status-verification-table"><caption className="sr-only">Verification coverage and limitations</caption><thead><tr><th>Target</th><th>Recorded evidence</th><th>Remaining uncertainty</th></tr></thead><tbody><tr><th>Commerce & persistence</th><td>Actual Prisma/HTTP tests in a disposable schema: customer verification, addresses, live-price changes, orders, cancellation and chat restoration.</td><td>Production load, failover and all business data shapes.</td></tr><tr><th>Shopping assistant</th><td>Mock tool tests and live scope checks for shopping, unrelated questions and bypass attempts.</td><td>Broad model accuracy, latency and provider availability.</td></tr><tr><th>Frontend</th><td>Production builds, API proxy tests and form/confirmation render checks.</td><td>Full browser, mobile-device and assistive-technology coverage.</td></tr><tr><th>Email delivery</th><td>Expiry, invalid sender, provider rejection and resend behavior are tested.</td><td>Inbox placement and delivery to other customers with a verified domain.</td></tr></tbody></table></div></section>
    <section className="status-section" aria-labelledby="milestone-title"><div className="status-section-heading"><div><span className="status-eyebrow">03 / Release gates</span><h2 id="milestone-title">What a hosted release still needs.</h2><p>Acceptance criteria, not promised dates.</p></div></div><div className="status-milestones"><Disclosure title="01 · Customer experience validation" defaultOpen><ul><li><Check size={14}/>Verify OTP delivery using the intended sender domain.</li><li><Check size={14}/>Run complete shopping journeys on supported mobile and desktop browsers.</li><li><Check size={14}/>Evaluate catalog relevance, grounded answers and accessibility.</li></ul></Disclosure><Disclosure title="02 · Operational readiness"><ul><li><Check size={14}/>Configure HTTPS, secure cookies, monitoring and recovery procedures.</li><li><Check size={14}/>Test load, retries, connection pools and provider limits.</li><li><Check size={14}/>Define conversation retention and deletion policies.</li></ul></Disclosure><Disclosure title="03 · Business integrations"><ul><li><Check size={14}/>Define fulfillment ownership and permitted order-status transitions.</li><li><Check size={14}/>Add payment, refund or courier integration only with explicit transaction rules.</li><li><Check size={14}/>Repeat ownership and idempotency checks for every new integration.</li></ul></Disclosure></div></section>
    <section className="status-scope-note" aria-labelledby="scope-title"><div><span className="status-eyebrow">Evaluation boundary</span><h2 id="scope-title">Match the scope to the decision.</h2></div><p>Use this release to evaluate the connected shopping journey. Chats and carts persist in Supabase, email verification protects customer access, and purchases remain pay on delivery. Hosted operations, payments and fulfillment integrations require further work.</p><Link to="/docs/quickstart">Evaluate the local prototype <ArrowRight size={16}/></Link></section>
  </div>;
}
