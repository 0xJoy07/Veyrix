import { useEffect, useState } from 'react';
import { ArrowUpRight, Camera, CheckCircle2, Mail, MapPin, MessageSquare, ShieldCheck } from 'lucide-react';
import { DocCallout, DocumentSection, OnThisPage, ReadingLink } from '@/components/docs/document-parts';
import './demo-chat.css';

type Screenshot = { file: string; title: string; alt: string; caption?: string };
const sections = [{ id: 'demo-journey', label: 'Try the customer journey' }, { id: 'demo-controls', label: 'Interactive controls' }, { id: 'demo-screenshots', label: 'Screenshot gallery' }, { id: 'demo-storage', label: 'Saved conversations' }, { id: 'demo-limits', label: 'Prototype boundaries' }];
const steps = [
  { Icon: ShieldCheck, title: 'Identify and verify', text: 'Enter your email or Indian mobile number. New customers provide a name, email and mobile. A six-digit email code is valid for ten minutes; replacement codes invalidate the previous one.' },
  { Icon: MessageSquare, title: 'Explore the live catalog', text: 'Ask for products, compare reviews, and refine your cart. Product and review tools read the configured catalog. Use an isolated demo catalog for this walkthrough. Unrelated questions are redirected to shopping.' },
  { Icon: MapPin, title: 'Choose delivery details', text: 'Select a saved address or add a new one in the chat. Recipient name, Indian mobile, street address, landmark, city, state and PIN code are required.' },
  { Icon: CheckCircle2, title: 'Review, then confirm', text: 'The review card shows items, quantities, delivery details and total. Select Confirm order to commit a pay-on-delivery order. A conversational yes does not place it.' },
  { Icon: Mail, title: 'Return securely', text: 'End chat to receive a farewell and chat ID. To retrieve it later, supply the ID and account email or phone, then complete fresh email verification.' },
];
function ScreenshotGallery() {
  const [shots, setShots] = useState<Screenshot[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/screenshots/demochat/manifest.json', { signal: controller.signal }).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(data => {
      if (Array.isArray(data.screenshots)) setShots(data.screenshots.filter((s: Screenshot) => typeof s?.file === 'string' && /^[a-zA-Z0-9_-]+\.(png|jpe?g|webp)$/.test(s.file) && typeof s.title === 'string' && typeof s.alt === 'string'));
    }).catch(() => {}).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  if (loading) return <p role="status">Loading screenshot gallery…</p>;
  if (!shots.length) return <div className="demo-capture-empty"><Camera size={28} aria-hidden="true"/><h3>Ready for real captures.</h3><p>The screenshot folder is prepared for actual interface captures from an isolated demo environment. Use fictional records only; no business database screens are published here.</p><a href="/screenshots/demochat/README.md" className="doc-inline-link">Screenshot capture guide <ArrowUpRight size={15}/></a></div>;
  return <div className="demo-shot-grid">{shots.map(shot => <figure key={shot.file}><a href={`/screenshots/demochat/${shot.file}`} target="_blank" rel="noreferrer"><img src={`/screenshots/demochat/${shot.file}`} alt={shot.alt} loading="lazy" onError={event => { event.currentTarget.hidden = true; }}/></a><figcaption><strong>{shot.title}</strong>{shot.caption && <span>{shot.caption}</span>}</figcaption></figure>)}</div>;
}
export default function DemoChat() {
  return <div className="knowledge-page demo-guide-page">
    <header className="doc-hero"><p className="kicker">DOCUMENTATION / DEMO CHAT</p><h1>A real shopping journey.<br/><span>One conversation at a time.</span></h1><p>The React chat is the working customer interface for the Veyrix prototype. This walkthrough follows the implemented verification, catalog, checkout and conversation-retrieval flow.</p><div className="doc-meta"><span><MessageSquare size={14}/>Interactive prototype</span><span>Demo walkthrough · no business data</span></div></header>
    <div className="doc-layout"><OnThisPage sections={sections}/><article className="doc-article">
      <DocumentSection id="demo-journey" number="01" title="Try the customer journey" description="Start the three services using the Quickstart guide, then open the local chat at 127.0.0.1:5174.">
        <ol className="demo-journey-list">{steps.map(({ Icon, title, text }, index) => <li key={title}><span className="demo-step-icon"><Icon size={19}/></span><div><span className="doc-overline">Step {index + 1}</span><h3>{title}</h3><p>{text}</p></div></li>)}</ol>
        <DocCallout title="This documentation does not log you into the chat">The documentation website and chat frontend are separate applications. Customer verification, cookies and order actions belong to the chat service.</DocCallout>
      </DocumentSection>
      <DocumentSection id="demo-controls" number="02" title="Forms and buttons do the important work" description="The assistant prepares an action. The customer reviews and authorizes it.">
        <div className="demo-control-grid"><div className="doc-surface"><h3>Delivery form</h3><p>Saved addresses are shown only after verification. Add a new Indian address without pasting personal details into a chat message. Landmark is required.</p></div><div className="doc-surface"><h3>Order review</h3><p>The confirmation endpoint checks current prices and stock again. Changed details require a fresh review. Successful orders and stock changes are saved together.</p></div><div className="doc-surface"><h3>Cancellation review</h3><p>Only confirmed or preparing orders are eligible. Dispatch between the review and confirmation blocks cancellation. Duplicate confirmations do not restore stock twice.</p></div><div className="doc-surface"><h3>Explicit confirmation</h3><p>The model has no commit tool. Use the confirmation button; terminal instructions such as slash commands are not part of the customer experience.</p></div></div>
      </DocumentSection>
      <DocumentSection id="demo-screenshots" number="03" title="See the prototype" description="Interface captures from an isolated demo environment using fictional records only."><ScreenshotGallery/></DocumentSection>
      <DocumentSection id="demo-storage" number="04" title="A chat ID locates a conversation. Verification unlocks it.">
        <p>Conversations are persisted in a private database table in Supabase. Each row contains its chat ID, customer association, messages as JSON, cart and pending state. The active application does not persist chat history in local files or browser storage.</p>
        <p>Returning to a saved conversation starts a fresh OTP challenge tied to its owner and chat ID. Knowing an ID alone cannot retrieve messages. Ended conversations remain read-only; start a new conversation to continue shopping.</p>
        <DocCallout title="Existing data remains separate" tone="mint">Historical order snapshots are preserved. Current product tools query the configured catalog and reviews. This guide does not publish business records or database identifiers.</DocCallout>
      </DocumentSection>
      <DocumentSection id="demo-limits" number="05" title="What to expect from this prototype">
        <ul className="doc-list"><li>Payment is pay on delivery. No online payment gateway is implemented.</li><li>Resend’s test sender can email only the address associated with its account. Sending to other customers requires a verified sending domain.</li><li>Old customer records without an email require an administrator to establish ownership and link verified contact details.</li><li>Indian PIN codes are checked for format; delivery-carrier serviceability is not integrated.</li><li>Database, email and model services must be available. An accepted email is not proof of inbox delivery.</li></ul>
        <div className="doc-two-up"><ReadingLink to="/docs/quickstart" label="Run the prototype" title="Setup and live logs">Configure services, start the terminals, and diagnose a failed request.</ReadingLink><ReadingLink to="/architecture" label="Follow the data" title="How the services cooperate">Understand the Node commerce service, Python worker and Supabase boundaries.</ReadingLink></div>
      </DocumentSection>
    </article></div>
  </div>;
}

