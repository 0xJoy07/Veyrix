import { Play, Pause, StepForward, ArrowDown, MessageSquare, Layers3, Bot, Database, ShoppingCart, ClipboardCheck } from "lucide-react";
"use client"

import { createContext, useContext, useEffect, useId, useState } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"

const PausedContext = createContext(false)
const messages = [
  'Customer: "Help me find walking shoes within my budget."',
  'Session: load conversation history and temporary cart.',
  'Agent: select a catalog tool using LangChain and Groq.',
  'Catalog: read matching products, prices, and stock from SQL.',
  'Reviews: retrieve available customer feedback.',
  'Cart: validate requested quantities against stock.',
  'Order: prepare a summary and a short-lived confirmation ID.',
  'Awaiting explicit customer confirmation through the CLI.',
  'After confirmation: save the order and update stock atomically.',
  'Example complete. Orders persist; chat and cart remain temporary.',
]

function AnimatedDot({
  path,
  duration,
  delay,
  size,
  opacity,
}: {
  path: string
  duration: number
  delay: number
  size: number
  opacity: number
}) {
  const paused = useContext(PausedContext)
  if (paused) return null
  return (
    <circle r={size} fill="#0052FF" opacity={opacity}>
      <animateMotion
        dur={`${duration}s`}
        repeatCount="indefinite"
        begin={`${delay}s`}
        path={path}
      />
    </circle>
  )
}

function PulsingDot({
  cx,
  cy,
  color,
  duration,
  delay = 0,
}: {
  cx: number
  cy: number
  color: string
  duration: number
  delay?: number
}) {
  const paused = useContext(PausedContext)
  return (
    <motion.circle
      cx={cx}
      cy={cy}
      r={2.8}
      fill={color}
      animate={{ opacity: paused ? 0.8 : [0.15, 1, 0.15] }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
  )
}

function StatusIndicator({
  cx,
  cy,
  color,
  pulsing = false,
  duration = 1.9,
  delay = 0,
}: {
  cx: number
  cy: number
  color: string
  pulsing?: boolean
  duration?: number
  delay?: number
}) {
  const paused = useContext(PausedContext)
  if (pulsing && !paused) {
    return (
      <motion.circle
        cx={cx}
        cy={cy}
        r={3}
        fill={color}
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{
          duration,
          delay,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    )
  }
  return <circle cx={cx} cy={cy} r={3} fill={color} opacity={0.95} />
}

export default function EnterpriseAIPipeline() {
  const [messageIndex, setMessageIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const reducedMotion = useReducedMotion()
  const stopped = paused || !!reducedMotion
  const markerId = `pipeline-arrow-${useId().replace(/:/g, '')}`
  useEffect(() => {
    if (stopped) return
    const interval = setInterval(() => setMessageIndex(prev => (prev + 1) % messages.length), 2700)
    return () => clearInterval(interval)
  }, [stopped])

  const paths = {
    p1: "M116,88 L158,88",
    p2: "M268,88 L306,88",
    p3: "M411,88 C425,88 435,50 448,50",
    p4: "M411,88 L448,88",
    p5: "M411,88 C425,88 435,126 448,126",
  }

  return (
    <PausedContext.Provider value={stopped}><div className="veyrix-pipeline bg-[#090909] border border-white/[0.08] rounded-[14px] overflow-hidden font-sans w-full max-w-[900px] mx-auto">
      {/* Header */}
      <div className="pipeline-header px-[18px] py-[11px] border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-[7px]">
          <motion.span
            className="w-[6px] h-[6px] rounded-full bg-green-500 inline-block"
            animate={{ opacity: stopped ? 1 : [1, 0.2, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
          <span className="text-[10px] text-white/65 tracking-[0.1em] font-sans">
            VEYRIX PIPELINE · ILLUSTRATIVE
          </span>
        </div>
        <span className="text-[10px] text-white/55 font-sans">
          Local shopping agent
        </span>
      </div>

      {/* SVG Pipeline Visualization */}
      <div className="pipeline-scroll"><svg role="img" aria-label="Customer query flows into session context, then the LangChain and Groq agent, which can use catalog, cart, and order-preparation tools." width="100%" viewBox="0 0 580 172" className="block min-w-[580px]">
        <defs>
          <marker
            id={markerId}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path
              d="M2 1.5L7.5 5L2 8.5"
              fill="none"
              stroke="rgba(100,155,255,0.95)"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </marker>
        </defs>

        {/* Connection Paths */}
        <path
          d={paths.p1}
          fill="none"
          stroke="rgba(0,82,255,0.22)"
          strokeWidth="1.5"
          strokeDasharray="3 5"
          markerEnd={`url(#${markerId})`}
        />
        <path
          d={paths.p2}
          fill="none"
          stroke="rgba(0,82,255,0.22)"
          strokeWidth="1.5"
          strokeDasharray="3 5"
          markerEnd={`url(#${markerId})`}
        />
        <path
          d={paths.p3}
          fill="none"
          stroke="rgba(0,82,255,0.15)"
          strokeWidth="1.5"
          strokeDasharray="3 5"
        />
        <path
          d={paths.p4}
          fill="none"
          stroke="rgba(0,82,255,0.15)"
          strokeWidth="1.5"
          strokeDasharray="3 5"
        />
        <path
          d={paths.p5}
          fill="none"
          stroke="rgba(0,82,255,0.15)"
          strokeWidth="1.5"
          strokeDasharray="3 5"
        />

        {/* Animated dots along paths */}
        <AnimatedDot path={paths.p1} duration={1.05} delay={0} size={2.5} opacity={1} />
        <AnimatedDot path={paths.p1} duration={1.05} delay={0.35} size={1.8} opacity={0.65} />
        <AnimatedDot path={paths.p1} duration={1.05} delay={0.7} size={1.3} opacity={0.35} />

        <AnimatedDot path={paths.p2} duration={0.88} delay={0.18} size={2.5} opacity={1} />
        <AnimatedDot path={paths.p2} duration={0.88} delay={0.62} size={1.8} opacity={0.65} />

        <AnimatedDot path={paths.p3} duration={1.3} delay={0.08} size={2.2} opacity={0.9} />
        <AnimatedDot path={paths.p3} duration={1.3} delay={0.65} size={1.5} opacity={0.55} />

        <AnimatedDot path={paths.p4} duration={1.15} delay={0.28} size={2.2} opacity={0.9} />
        <AnimatedDot path={paths.p4} duration={1.15} delay={0.85} size={1.5} opacity={0.55} />

        <AnimatedDot path={paths.p5} duration={1.4} delay={0.45} size={2.2} opacity={0.9} />
        <AnimatedDot path={paths.p5} duration={1.4} delay={1.0} size={1.5} opacity={0.55} />

        {/* Trigger Node */}
        <rect
          x="16"
          y="66"
          width="100"
          height="44"
          rx="8"
          fill="#141414"
          stroke="rgba(255,255,255,0.09)"
          strokeWidth="0.5"
        />
        <text
          x="66"
          y="83"
          textAnchor="middle"
          fontSize="7"
          fill="rgba(255,255,255,0.65)"
          fontFamily="Inter Variable, sans-serif"
          letterSpacing=".07em"
        >
          CUSTOMER
        </text>
        <text
          x="66"
          y="100"
          textAnchor="middle"
          fontSize="9"
          fill="rgba(255,255,255,0.82)"
          fontFamily="Inter Variable, sans-serif"
        >
          Shopping query
        </text>
        <text
          x="66"
          y="122"
          textAnchor="middle"
          fontSize="6.5"
          fill="rgba(255,255,255,0.55)"
          fontFamily="Inter Variable, sans-serif"
        >
          local CLI
        </text>

        {/* Vector DB Node */}
        <rect
          x="158"
          y="66"
          width="110"
          height="44"
          rx="8"
          fill="#141414"
          stroke="rgba(255,255,255,0.09)"
          strokeWidth="0.5"
        />
        <text
          x="213"
          y="83"
          textAnchor="middle"
          fontSize="7"
          fill="rgba(255,255,255,0.65)"
          fontFamily="Inter Variable, sans-serif"
          letterSpacing=".07em"
        >
          SESSION
        </text>
        <text
          x="213"
          y="100"
          textAnchor="middle"
          fontSize="9"
          fill="rgba(255,255,255,0.82)"
          fontFamily="Inter Variable, sans-serif"
        >
          History + cart
        </text>
        <text
          x="213"
          y="122"
          textAnchor="middle"
          fontSize="6.5"
          fill="rgba(255,255,255,0.55)"
          fontFamily="Inter Variable, sans-serif"
        >
          in memory
        </text>

        {/* LLM Agent Node */}
        <rect
          x="306"
          y="53"
          width="105"
          height="70"
          rx="10"
          fill="#050D1C"
          stroke="#0052FF"
          strokeWidth="1"
        />
        <rect x="318" y="53.5" width="80" height="1" rx="0.5" fill="rgba(51,117,255,0.5)" />
        <text
          x="358"
          y="78"
          textAnchor="middle"
          fontSize="7"
          fill="rgba(100,155,255,0.95)"
          fontFamily="Inter Variable, sans-serif"
          letterSpacing=".07em"
        >
          LLM AGENT
        </text>
        <text
          x="358"
          y="97"
          textAnchor="middle"
          fontSize="9.5"
          fill="#fff"
          fontFamily="Inter Variable, sans-serif"
          fontWeight="500"
        >
          Tool selection
        </text>
        <PulsingDot cx={346} cy={113} color="#0052FF" duration={1.2} delay={0} />
        <PulsingDot cx={358} cy={113} color="#0052FF" duration={1.2} delay={0.4} />
        <PulsingDot cx={370} cy={113} color="#0052FF" duration={1.2} delay={0.8} />
        <text
          x="358"
          y="139"
          textAnchor="middle"
          fontSize="6.5"
          fill="rgba(100,155,255,0.9)"
          fontFamily="Inter Variable, sans-serif"
        >
          LangChain / Groq
        </text>

        {/* Output Nodes */}
        <rect
          x="448"
          y="35"
          width="116"
          height="30"
          rx="7"
          fill="#111"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="0.5"
        />
        <text
          x="490"
          y="53.5"
          textAnchor="middle"
          fontSize="8.5"
          fill="rgba(255,255,255,0.62)"
          fontFamily="Inter Variable, sans-serif"
        >
          Catalog
        </text>
        <StatusIndicator cx={550} cy={43} color="#22c55e" />

        <rect
          x="448"
          y="73"
          width="116"
          height="30"
          rx="7"
          fill="#111"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="0.5"
        />
        <text
          x="490"
          y="91.5"
          textAnchor="middle"
          fontSize="8.5"
          fill="rgba(255,255,255,0.62)"
          fontFamily="Inter Variable, sans-serif"
        >
          Cart
        </text>
        <StatusIndicator cx={550} cy={81} color="#f59e0b" pulsing duration={1.9} />

        <rect
          x="448"
          y="111"
          width="116"
          height="30"
          rx="7"
          fill="#111"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="0.5"
        />
        <text
          x="490"
          y="129.5"
          textAnchor="middle"
          fontSize="8.5"
          fill="rgba(255,255,255,0.62)"
          fontFamily="Inter Variable, sans-serif"
        >
          Order draft
        </text>
        <StatusIndicator cx={550} cy={119} color="#f59e0b" pulsing duration={2.2} delay={0.35} />
      </svg></div>

      <div className="pipeline-mobile" aria-label="Shopping agent workflow">
        <div className="pipeline-mobile-node"><MessageSquare size={18} aria-hidden="true"/><div><span>Customer</span><strong>Shopping query</strong></div><small>Local CLI</small></div>
        <ArrowDown className="pipeline-mobile-connector" size={18} aria-hidden="true"/>
        <div className="pipeline-mobile-node"><Layers3 size={18} aria-hidden="true"/><div><span>Session</span><strong>History + cart</strong></div><small>In memory</small></div>
        <ArrowDown className="pipeline-mobile-connector" size={18} aria-hidden="true"/>
        <div className="pipeline-mobile-node pipeline-mobile-agent"><Bot size={20} aria-hidden="true"/><div><span>LLM agent</span><strong>Tool selection</strong></div><small>LangChain / Groq</small></div>
        <ArrowDown className="pipeline-mobile-connector" size={18} aria-hidden="true"/>
        <div className="pipeline-mobile-tools"><span><Database size={16} aria-hidden="true"/>Catalog</span><span><ShoppingCart size={16} aria-hidden="true"/>Cart</span><span><ClipboardCheck size={16} aria-hidden="true"/>Order draft</span></div>
        <p>Tools are selected as needed.</p>
      </div>

      {/* Message Display */}
      <div className="pipeline-message border-t border-white/[0.06] px-[18px] py-[9px]">
        <div className="flex gap-2 items-start h-full">
          <span className="text-[#0052FF]/55 font-sans text-[13px] leading-[1.5] shrink-0">
            ›
          </span>
          <div className="pipeline-message-stack relative flex-1">
            {messages.map(message => <span key={message} className="pipeline-message-reserve" aria-hidden="true">{message}</span>)}
            <AnimatePresence mode="wait">
              <motion.div
                key={messageIndex}
                initial={stopped ? false : { opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: stopped ? 0 : -5 }}
                transition={{ duration: 0.25 }}
                className="pipeline-message-text font-sans text-[11px] text-white/75 leading-[1.55]"
              >
                {messages[messageIndex]}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="pipeline-footer">
        <div><span>EXAMPLE STEP</span><strong>{String(messageIndex + 1).padStart(2, '0')} / {messages.length}</strong></div>
        <div><span>STACK</span><strong>LangChain · Groq · SQL</strong></div>
        <div className="pipeline-controls">
          <button type="button" className="pipeline-playback" disabled={!!reducedMotion} onClick={() => setPaused(value => !value)}><span className="playback-icon" aria-hidden="true">{stopped ? <Play size={14}/> : <Pause size={14}/>}</span>{reducedMotion ? 'Reduced motion' : paused ? 'Play example' : 'Pause example'}</button>
          <button type="button" className="pipeline-playback" onClick={() => { setPaused(true); setMessageIndex(index => (index + 1) % messages.length) }}><span className="playback-icon" aria-hidden="true"><StepForward size={15}/></span>Next step</button>
        </div>
      </div>
    </div></PausedContext.Provider>
  )
}
