import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, History, LogOut, MapPin, MessageCircleDashed, ShoppingBag } from 'lucide-react';
import { MotionConfig } from 'motion/react';
import { AIChatCard, type ChatMessage } from '@/components/ui/ai-chat-card';
import { DeliveryCard, FarewellCard, IdentityCard, OtpCard, ProfileCard, type Address, type AddressInput, type AuthInput, type Challenge, type Customer } from '@/components/commerce-cards';
import { ApiError, request } from '@/lib/api';

type Pending = { token?: string; kind?: string; [key: string]: unknown };
type Account = { authenticated: boolean; customer?: Customer; addresses?: Address[]; chat_id?: string; messages?: Array<{ id?: string; role: string; content: string }>; pending?: Pending; ended?: boolean; profile_required?: boolean };
type ChatResponse = { answer?: string; pending?: Pending; chat_id?: string; action?: string; messages?: Account['messages'] };
const suggestions = ['Help me find walking shoes', 'What are your best-rated products?', 'Show me my cart'];
function toMessages(messages: Account['messages'] = []): ChatMessage[] {
  return messages.filter(message => ['user', 'human', 'assistant', 'ai'].includes(message.role) && typeof message.content === 'string').map(message => ({ id: message.id || crypto.randomUUID(), role: message.role === 'user' || message.role === 'human' ? 'user' : 'assistant', content: message.content }));
}
export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [chatId, setChatId] = useState('');
  const [ended, setEnded] = useState(false);
  const [profileRequired, setProfileRequired] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [restore, setRestore] = useState(false);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [authInput, setAuthInput] = useState<AuthInput | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState('Connecting');
  const [retry, setRetry] = useState<string | null>(null);
  const locked = useRef(false);
  const ready = !!customer && !restore && !challenge && !ended && !loading && !profileRequired;
  function applyAccount(account: Account) {
    setCustomer(account.authenticated && account.customer ? account.customer : null);
    setAddresses(account.addresses || []); setChatId(account.chat_id || '');
    setMessages(toMessages(account.messages)); setPending(account.pending?.token ? account.pending : null);
    setProfileRequired(account.profile_required || false); setEnded(account.ended || false); setCheckout(false); setRetry(null);
  }
  useEffect(() => {
    const controller = new AbortController();
    request<Account>('/api/account', undefined, 'GET', controller.signal).then(account => { applyAccount(account); setConnection('Connected securely'); }).catch(caught => {
      if (!controller.signal.aborted) { setError(caught instanceof Error ? caught.message : 'Could not connect to Veyrix.'); setConnection('Connection unavailable'); }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  async function perform(work: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(null);
    try { await work(); setConnection('Connected securely'); }
    catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong. Please try again.');
      if (caught instanceof ApiError && ['unauthorized', 'authentication_required', 'session_expired', 'verification_required'].includes(caught.code)) { setCustomer(null); setPending(null); setCheckout(false); setMessages([]); setAddresses([]); setChatId(''); }
      if (caught instanceof ApiError) {
        if (caught.code === 'profile_required') setProfileRequired(true);
        if (['confirmation_expired', 'order_changed', 'stock_changed', 'cannot_cancel', 'invalid_confirmation'].includes(caught.code)) setPending(null);
        if (caught.code === 'chat_ended') { setEnded(true); setPending(null); setCheckout(false); }
      }
      throw caught;
    } finally { locked.current = false; setBusy(false); }
  }
  function launch(work: () => Promise<void>) { void perform(work).catch(() => {}); }
  function receive(result: ChatResponse) {
    if (result.answer) setMessages(previous => [...previous, { id: crypto.randomUUID(), role: 'assistant', content: result.answer! }]);
    setPending(result.pending?.token ? result.pending : null);
    if (result.chat_id) setChatId(result.chat_id);
    if (result.action === 'checkout') setCheckout(true);
  }
  function startVerification(input: AuthInput) {
    launch(async () => { const result = await request<Challenge>('/api/auth/start', input); setAuthInput(input); setChallenge(result); });
  }
  function send(message: string, retrying = false) {
    if (!ready || locked.current) return;
    if (!retrying) setMessages(previous => [...previous, { id: crypto.randomUUID(), role: 'user', content: message }]);
    setRetry(null);
    launch(async () => {
      try { receive(await request<ChatResponse>('/api/chat', { message })); }
      catch (caught) { setRetry(message); throw caught; }
    });
  }
  function reset() {
    launch(async () => { const result = await request<ChatResponse>('/api/chat/reset'); setMessages(toMessages(result.messages)); setChatId(result.chat_id || ''); setPending(null); setCheckout(false); setEnded(false); setRetry(null); });
  }
  const interaction = loading ? <p className="py-20 text-center text-sm text-muted-foreground" role="status">Getting your shopping companion ready…</p>
    : challenge ? <OtpCard challenge={challenge} busy={busy} onVerify={code => launch(async () => { const account = await request<Account>('/api/auth/verify', { challenge_id: challenge.challenge_id, code }); applyAccount(account); setChallenge(null); setAuthInput(null); setRestore(false); })} onResend={() => { if (authInput) startVerification(authInput); }} onBack={() => { setChallenge(null); setError(null); }}/>
    : !customer || restore ? <IdentityCard key={restore ? 'restore' : 'login'} restore={restore} busy={busy} onSubmit={startVerification} onBack={restore ? () => { setRestore(false); setError(null); } : undefined}/>
    : profileRequired ? <ProfileCard customer={customer} busy={busy} onSave={profile => launch(async () => { await request('/api/account/profile', profile); applyAccount(await request<Account>('/api/account', undefined, 'GET')); })}/>
    : ended ? <FarewellCard chatId={chatId} busy={busy} onNew={reset}/>
    : checkout ? <DeliveryCard addresses={addresses} customer={customer} busy={busy} onSave={async (address: AddressInput) => { await perform(async () => { const result = await request<{ addresses: Address[]; address: Address }>('/api/addresses', address); setAddresses(result.addresses); }); }} onSelect={addressId => launch(async () => { receive(await request<ChatResponse>('/api/checkout/prepare', { address_id: addressId })); setCheckout(false); })} onClose={() => setCheckout(false)}/>
    : null;
  return <MotionConfig reducedMotion="user"><div className="page-shell">
    <header className="flex items-center justify-between border-b border-black/10 pb-6">
      <a href="/" className="flex items-center gap-2.5 text-xl font-semibold tracking-tight" aria-label="Veyrix home"><span className="flex size-8 items-center justify-center rounded-lg bg-[#252923] text-white"><ShoppingBag size={17}/></span>veyrix<span className="ml-3 border-l border-black/15 pl-4 text-xs font-normal tracking-normal text-muted-foreground">Your shopping companion</span></a>
      <span className="rounded-full border border-black/10 px-3 py-1.5 text-[11px] font-medium tracking-wide">SHOPPING, SIMPLIFIED</span>
    </header>
    <main className="demo-layout">
      <section>
        <p className="mb-6 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em]"><span className="size-1.5 rounded-full bg-[#70845b]"/> Personal finds. Thoughtfully delivered.</p>
        <h1 className="editorial-title">Good finds.<br/><span className="italic text-[#78816d]">Great conversations.</span></h1>
        <p className="mt-7 max-w-sm text-[15px] leading-7 text-muted-foreground">A little help finding just the right thing. Discover products, compare reviews, and take care of your order—all in one conversation.</p>
        <div className="mt-9 max-w-sm border-t border-black/10 pt-6"><p className="mb-3 text-[11px] uppercase tracking-[0.15em] text-muted-foreground">A few ways to start</p>
          {suggestions.map(suggestion => <button key={suggestion} disabled={busy || !ready} onClick={() => send(suggestion)} className="flex w-full items-center justify-between gap-3 border-b border-black/8 py-3 text-left text-sm hover:text-[#61754b] disabled:opacity-40">{suggestion}<ArrowUpRight size={15}/></button>)}
        </div>
        <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground"><Check size={14}/> Orders are placed only after you confirm.</p>
        <button type="button" disabled={busy || loading} className="mt-6 flex items-center gap-2 text-xs font-medium underline underline-offset-4" onClick={() => { setRestore(true); setChallenge(null); setError(null); }}><History size={15}/>Return to a saved conversation</button>
      </section>
      <section aria-label="Shopping conversation" className="min-w-0">
        {customer && !restore && !challenge && <div className="conversation-toolbar"><span className="min-w-0 truncate">Welcome, {customer.name.split(' ')[0]}</span><div>{!ended && !profileRequired && <><button disabled={busy || loading} onClick={() => { setCheckout(true); setPending(null); setError(null); }}><MapPin size={14}/>Checkout</button><button disabled={busy || loading} onClick={() => launch(async () => { const result = await request<ChatResponse>('/api/chat/end'); receive(result); setCheckout(false); setPending(null); setEnded(true); })}><LogOut size={14}/>End chat</button></>}<button disabled={busy || loading} onClick={() => launch(async () => { await request("/api/auth/logout"); applyAccount({ authenticated: false }); setChallenge(null); setAuthInput(null); setRestore(false); })}>Sign out</button></div></div>}
        <AIChatCard title="Your shopping companion" subtitle={customer && !restore ? 'A good place to find your next favorite.' : 'A personal experience starts with a secure hello.'} greeting="What can I help you find?" prompt="Tell me what you have in mind. We’ll find it together." placeholder="Ask about products, reviews, or your cart…" prompts={suggestions} icon={<MessageCircleDashed className="size-5"/>} messages={restore || !customer ? [] : messages} pending={ready && !checkout ? pending : null} isLoading={busy} error={error} onSend={message => send(message)} onReset={ready ? reset : undefined} onConfirm={() => launch(async () => receive(await request<ChatResponse>('/api/chat/confirm', { confirmation_id: pending?.token })))} interaction={interaction} composerEnabled={ready && !checkout} className="chat-surface"/>
        {retry && !busy && ready && <button className="mt-3 text-xs underline underline-offset-4" onClick={() => send(retry, true)}>Retry last message</button>}
        <p className="mt-4 text-center text-[11px] text-muted-foreground">Your details stay private. Review your order before confirming.</p>
      </section>
    </main>
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-5 text-[11px] text-muted-foreground"><span>Veyrix · Conversational commerce</span><span className="flex items-center gap-2"><span className={`size-1.5 rounded-full ${connection === 'Connected securely' ? 'bg-[#70845b]' : 'bg-[#b3a58b]'}`}/>{connection}</span></footer>
  </div></MotionConfig>;
}
