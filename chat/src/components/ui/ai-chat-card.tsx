"use client";

import * as React from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { ArrowUp, Check, MessageCircleDashed, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTypewriter } from "@/components/ui/ai-chat-card-utils/use-typewriter";
import { MarkdownResponse } from "@/components/ui/markdown-response";
import { ThinkingStatus } from "@/components/ui/thinking-status";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface AIChatCardProps {
  title?: string;
  subtitle?: string;
  greeting?: string;
  prompt?: string;
  prompts?: string[];
  autoType?: boolean;
  placeholder?: string;
  icon?: React.ReactNode;
  onSend?: (message: string) => void;
  onReset?: () => void;
  className?: string;
  messages?: ChatMessage[];
  isLoading?: boolean;
  error?: string | null;
  pending?: unknown;
  onConfirm?: () => void;
}

const DEFAULT_PROMPTS = [
  "Help me find my next favorite pair of shoes…",
  "What do customers say about these products?",
  "Show me what's in my cart",
];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function formatMoney(value: unknown, currency: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Unavailable";
  const code = typeof currency === "string" ? currency : "";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: code }).format(value / 100);
  } catch {
    return `${code} ${(value / 100).toFixed(2)}`.trim();
  }
}

export function AIChatCard({
  title = "New conversation",
  subtitle = "Your personal shopping assistant",
  greeting = "A little help. A great find.",
  prompt = "Tell me what you're looking for. We'll find something that feels right.",
  prompts = DEFAULT_PROMPTS,
  autoType = true,
  placeholder = "Ask your shopping assistant…",
  icon, onSend, onReset, className,
  messages = [], isLoading = false, error = null, pending, onConfirm,
}: AIChatCardProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const nearBottom = React.useRef(true);
  const inView = useInView(rootRef, { margin: "-10% 0px" });
  const reduceMotion = useReducedMotion();
  const [focused, setFocused] = React.useState(false);
  const [userMessage, setUserMessage] = React.useState("");
  const [spins, setSpins] = React.useState(0);
  const { text: typedMessage } = useTypewriter(prompts, {
    enabled: autoType && inView && !focused && !userMessage && !messages.length && !reduceMotion,
  });
  const pendingRecord = asRecord(pending);
  const canConfirm = !!pendingRecord?.token && !!onConfirm;
  const cancellation = pendingRecord?.kind === "cancel";
  const summary = asRecord(pendingRecord?.summary);
  const items = Array.isArray(summary?.items) ? summary.items.map(asRecord).filter((item): item is Record<string, unknown> => item !== null) : [];

  React.useEffect(() => {
    if (scrollRef.current && nearBottom.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: reduceMotion ? "instant" : "smooth" });
    }
  }, [messages, isLoading, pending, reduceMotion]);

  function send() {
    const message = userMessage.trim();
    if (!message || isLoading || !onSend) return;
    nearBottom.current = true;
    onSend(message);
    setUserMessage("");
    textareaRef.current?.focus();
  }

  return (
    <div ref={rootRef} className={cn(
      "flex w-full min-w-0 min-h-[520px] flex-col overflow-hidden rounded-[24px] bg-white text-foreground",
      "shadow-[0_0_16.4px_1px_rgba(10,10,10,0.05),0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)]",
      "dark:bg-neutral-950 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.12)]", className,
    )}>
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 pb-4 pt-5 sm:px-6">
        <div className="min-w-0 break-words">
          <h2 className="text-base font-medium leading-6">{title}</h2>
          <p className="mt-0.5 text-sm leading-5 text-muted-foreground">{subtitle}</p>
        </div>
        <motion.button type="button" disabled={isLoading || !onReset} onClick={() => {
          setSpins((count) => count + 1);
          setUserMessage("");
          nearBottom.current = true;
          onReset?.();
        }} whileTap={reduceMotion ? undefined : { scale: 0.9 }} aria-label="Reset conversation" title="Start a new conversation"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-white text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-neutral-950">
          <motion.span animate={{ rotate: reduceMotion ? 0 : spins * 360 }} transition={{ type: "spring", bounce: 0.2, duration: 0.7 }} className="flex">
            <RefreshCw className="h-4 w-4" />
          </motion.span>
        </motion.button>
      </div>

      <div ref={scrollRef} onScroll={() => {
        const element = scrollRef.current;
        if (element) nearBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
      }} tabIndex={0} aria-label="Scrollable conversation" className="min-h-0 flex-1 overflow-y-auto overscroll-contain focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#c6d0ba]">
        {messages.length === 0 ? (
          <div className="flex min-h-[300px] h-full flex-col items-center justify-center px-7 py-12 text-center">
            <motion.div animate={reduceMotion ? undefined : { y: [0, -3, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-neutral-100 dark:bg-neutral-900">
              {icon ?? <MessageCircleDashed className="h-6 w-6" strokeWidth={1.5} />}
            </motion.div>
            <motion.p initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
              className="mt-5 text-xl font-medium leading-7 tracking-[-0.45px]">{greeting}</motion.p>
            <p className="mt-2 max-w-[270px] text-sm leading-[23px] text-muted-foreground">{prompt}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {["Explore the catalog", "Show my cart"].map((suggestion) => (
                <button key={suggestion} type="button" disabled={isLoading} onClick={() => {
                  setUserMessage(suggestion);
                  textareaRef.current?.focus();
                }} className="rounded-full border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-neutral-50 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 dark:hover:bg-neutral-900">{suggestion}</button>
              ))}
            </div>
          </div>
        ) : (
          <div role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions" className="space-y-6 px-5 py-6 sm:px-6">
            {messages.map((message) => (
              <div key={message.id} className={cn("flex flex-col", message.role === "user" ? "items-end" : "items-start")}>
                <p className="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{message.role === "user" ? "You" : "Veyrix"}</p>
                <div className={cn("min-w-0 break-words text-sm leading-6 [overflow-wrap:anywhere]", message.role === "user" ? "max-w-[92%] whitespace-pre-wrap rounded-[18px] rounded-tr-md bg-neutral-100 px-4 py-3 dark:bg-neutral-900" : "w-full max-w-full px-1")}>
                  {message.role === "assistant" ? <MarkdownResponse content={message.content} animate /> : message.content}
                </div>
              </div>
            ))}
          </div>
        )}
        {isLoading && <ThinkingStatus />}
      </div>

      <div className="shrink-0 px-5 pb-5 sm:px-6">
        {canConfirm && <div className="mb-3 rounded-2xl border border-border bg-neutral-50 p-3 dark:bg-neutral-900">
          <p className="text-sm font-medium">{cancellation ? "Confirm cancellation" : "Ready to place your order?"}</p>
          <div tabIndex={0} role="region" aria-label="Review pending action" className="mt-2 max-h-36 space-y-2 overflow-y-auto overscroll-contain pr-1 text-xs leading-5 [overflow-wrap:anywhere] focus-visible:outline-2 focus-visible:outline-offset-2">
            {cancellation ? <p>Order ID: <span className="font-medium">{typeof pendingRecord?.order_id === "string" ? pendingRecord.order_id : "Unavailable"}</span></p> : <>
              <ul className="space-y-1">
                {items.map((item, index) => <li key={`${String(item.id)}-${index}`} className="flex items-start justify-between gap-3">
                  <span className="min-w-0">{typeof item.name === "string" ? item.name : "Item"} <span className="text-muted-foreground">× {typeof item.quantity === "number" ? item.quantity : "?"}</span></span>
                  <span className="shrink-0">{formatMoney(typeof item.price_minor === "number" && typeof item.quantity === "number" ? item.price_minor * item.quantity : null, summary?.currency)}</span>
                </li>)}
              </ul>
              <div className="flex justify-between gap-3 text-muted-foreground"><span>Delivery</span><span>{formatMoney(summary?.delivery_minor, summary?.currency)}</span></div>
              <div className="flex justify-between gap-3 border-t border-border pt-2 font-medium"><span>Total {typeof summary?.currency === "string" ? `(${summary.currency})` : ""}</span><span>{formatMoney(summary?.total_minor, summary?.currency)}</span></div>
              <p><span className="font-medium">Deliver to: </span>{typeof summary?.address === "string" ? summary.address : "Unavailable"}</p>
              <p className="text-muted-foreground">Payment on delivery</p>
            </>}
          </div>
          <button type="button" disabled={isLoading} onClick={onConfirm} className="mt-3 flex items-center gap-2 rounded-full bg-neutral-950 px-4 py-2 text-xs font-medium text-white disabled:opacity-40 dark:bg-white dark:text-neutral-950"><Check className="h-3.5 w-3.5" />{cancellation ? "Confirm cancellation" : "Confirm order"}</button>
        </div>}
        {error && <p role="alert" className="mb-3 max-h-20 overflow-y-auto rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-800 [overflow-wrap:anywhere]">{error}</p>}
        <form onSubmit={(event) => { event.preventDefault(); send(); }} className="rounded-[18px] bg-neutral-200/50 p-3 focus-within:ring-1 focus-within:ring-neutral-300 dark:bg-neutral-800/50">
          <textarea ref={textareaRef} value={userMessage} onChange={(event) => setUserMessage(event.target.value)}
            onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault(); send();
              }
            }} placeholder={!focused && !messages.length && autoType && typedMessage ? typedMessage : placeholder}
            aria-label="Message your shopping assistant" maxLength={8000} rows={2}
            className="w-full resize-none bg-transparent text-base leading-5 text-foreground outline-none placeholder:text-muted-foreground sm:text-sm" />
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[10px] text-muted-foreground">Enter to send · Shift + Enter for a new line</span>
            <motion.button type="submit" disabled={isLoading || !userMessage.trim() || !onSend}
              whileHover={reduceMotion ? undefined : { scale: 1.08 }} whileTap={reduceMotion ? undefined : { scale: 0.88 }}
              aria-label="Send message" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-800 disabled:cursor-not-allowed disabled:opacity-30 dark:bg-white dark:text-neutral-950">
              <ArrowUp className="h-4 w-4" />
            </motion.button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AIChatCard;
