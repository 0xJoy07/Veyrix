import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, MessageCircleDashed, ShoppingBag } from 'lucide-react';
import { MotionConfig } from 'motion/react';
import { AIChatCard, type ChatMessage } from '@/components/ui/ai-chat-card';
import { request } from '@/lib/api';

type Pending = { token?: string; kind?: string; [key: string]: unknown };
type ChatResponse = { answer: string; pending?: Pending };
const suggestions = ['Help me find walking shoes', 'What are your best-rated products?', 'Show me my cart'];

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState('Checking connection');
  const [retry, setRetry] = useState<string | null>(null);
  const locked = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/health', { signal: controller.signal }).then(response => setConnection(response.ok ? 'Backend connected' : 'Backend unavailable')).catch(() => { if (!controller.signal.aborted) setConnection('Backend unavailable'); });
    return () => controller.abort();
  }, []);
  async function run(kind: 'send' | 'reset' | 'confirm', message?: string) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(null);
    if (kind === 'send' && message) {
      setMessages(previous => [...previous, { id: crypto.randomUUID(), role: 'user', content: message }]);
      setRetry(null);
    }
    try {
      if (kind === 'reset') {
        await request('/api/chat/reset'); setMessages([]); setPending(null); setRetry(null);
      } else {
        const result = await request<ChatResponse>(kind === 'send' ? '/api/chat' : '/api/chat/confirm', kind === 'send' ? { message } : { confirmation_id: pending?.token });
        setMessages(previous => [...previous, { id: crypto.randomUUID(), role: 'assistant', content: result.answer }]);
        setPending(result.pending?.token ? result.pending : null);
        setRetry(null);
        setConnection('Backend connected');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong. Please try again.');
      if (kind === 'send' && message) setRetry(message);
    } finally { locked.current = false; setBusy(false); }
  }
  return <MotionConfig reducedMotion="user"><div className="page-shell">
    <header className="flex items-center justify-between border-b border-black/10 pb-6">
      <a href="/" className="flex items-center gap-2.5 text-xl font-semibold tracking-tight" aria-label="Veyrix demo home"><span className="flex size-8 items-center justify-center rounded-lg bg-[#252923] text-white"><ShoppingBag size={17}/></span>veyrix<span className="ml-3 border-l border-black/15 pl-4 text-xs font-normal tracking-normal text-muted-foreground">Demo chat</span></a>
      <span className="rounded-full border border-black/10 px-3 py-1.5 text-[11px] font-medium tracking-wide">SHOPPING, SIMPLIFIED</span>
    </header>
    <main className="demo-layout">
      <section>
        <p className="mb-6 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em]"><span className="size-1.5 rounded-full bg-[#70845b]"/> Your personal shopping assistant</p>
        <h1 className="editorial-title">Good finds.<br/><span className="italic text-[#78816d]">Great conversations.</span></h1>
        <p className="mt-7 max-w-sm text-[15px] leading-7 text-muted-foreground">A little help finding just the right thing. Discover products, compare reviews, and take care of your order—all in one conversation.</p>
        <div className="mt-9 max-w-sm border-t border-black/10 pt-6"><p className="mb-3 text-[11px] uppercase tracking-[0.15em] text-muted-foreground">A few ways to start</p>
          {suggestions.map(suggestion => <button key={suggestion} disabled={busy} onClick={() => void run('send', suggestion)} className="flex w-full items-center justify-between gap-3 border-b border-black/8 py-3 text-left text-sm hover:text-[#61754b] disabled:opacity-40">{suggestion}<ArrowUpRight size={15}/></button>)}
        </div>
        <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground"><Check size={14}/> Orders are placed only after you confirm.</p>
      </section>
      <section aria-label="Shopping conversation" className="min-w-0">
        <AIChatCard title="Your shopping companion" subtitle="A good place to find your next favorite." greeting="What can I help you find?" prompt="Tell me what you have in mind. We’ll find it together." placeholder="Ask about products, reviews, or your cart…" prompts={suggestions} icon={<MessageCircleDashed className="size-5"/>} messages={messages} pending={pending} isLoading={busy} error={error} onSend={message => void run('send', message)} onReset={() => void run('reset')} onConfirm={() => void run('confirm')} className="chat-surface"/>
        {retry && !busy && <button className="mt-3 text-xs underline underline-offset-4" onClick={() => { setMessages(previous => previous.slice(0, -1)); void run('send', retry); }}>Retry last message</button>}
        <p className="mt-4 text-center text-[11px] text-muted-foreground">AI can make mistakes. Review product and order details.</p>
      </section>
    </main>
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-5 text-[11px] text-muted-foreground"><span>Veyrix · Conversational commerce</span><span className="flex items-center gap-2"><span className={`size-1.5 rounded-full ${connection === 'Backend connected' ? 'bg-[#70845b]' : 'bg-[#b3a58b]'}`}/>{connection}</span></footer>
  </div></MotionConfig>;
}
