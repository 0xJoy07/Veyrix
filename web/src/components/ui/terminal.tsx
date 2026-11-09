"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, Copy, Pause, Play, RotateCcw, List, TerminalSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import './terminal.css';

export type TerminalCommand = {
  input: string;
  output?: Array<string | { text: string; tone?: 'muted' | 'success' | 'warning' | 'error' | 'info' }>;
  runDelayMs?: number;
};
export type TerminalProps = {
  commands: TerminalCommand[];
  title?: string;
  promptSymbol?: string;
  typingSpeed?: number;
  startupDelay?: number;
  delayBetweenCommands?: number;
  autoStart?: boolean;
  className?: string;
};
type RunState = 'idle' | 'running' | 'paused' | 'done';

// Preserve every source character; these are visual hints, not a shell parser.
function Syntax({ text }: { text: string }) {
  const tokens = text.match(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\s+|[^\s]+/g) ?? [];
  let first = true;
  return <>{tokens.map((token,index) => {
    let tone = 'text';
    if (!/^\s+$/.test(token)) {
      if (first) tone = 'command';
      else if (/^["']/.test(token)) tone = 'string';
      else if (/^-/.test(token)) tone = 'flag';
      else if (/[\\/]/.test(token)) tone = 'path';
      first = false;
    }
    return <span className={`terminal-syntax-${tone}`} key={index}>{token}</span>;
  })}</>;
}

/** Animated documentation preview; this component never executes commands. */
export function Terminal({ commands, title='PowerShell · repository root', promptSymbol='PS >', typingSpeed=14, startupDelay=250, delayBetweenCommands=350, autoStart=true, className }: TerminalProps) {
  const reduceMotion = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [state, setState] = useState<RunState>('idle');
  const [cursor, setCursor] = useState({ command:0, character:0 });
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const started = useRef(false);
  const source = useMemo(() => commands.map(command => command.input).join('\n'), [commands]);
  const complete = reduceMotion || state === 'done';
  const fullTranscript = useMemo(() => commands.map(command => [command.input, ...(command.output ?? []).map(line => typeof line === 'string' ? line : line.text)].join('\n')).join('\n\n'), [commands]);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {threshold:0.15});
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setCursor({command:0,character:0}); setState('idle'); started.current=false; setCopyStatus('idle');
  }, [source]);

  useEffect(() => {
    if (!autoStart || !visible || started.current || reduceMotion) return;
    const timer = window.setTimeout(() => { started.current=true; setState('running'); }, startupDelay);
    return () => clearTimeout(timer);
  }, [autoStart,visible,reduceMotion,startupDelay,source]);

  useEffect(() => {
    if (state !== 'running' || !visible || reduceMotion) return;
    const command = commands[cursor.command];
    if (!command) { setState('done'); return; }
    const lineDone = cursor.character >= command.input.length;
    const timer = window.setTimeout(() => {
      if (!lineDone) setCursor(value => ({...value,character:value.character+1}));
      else if (cursor.command+1 < commands.length) setCursor({command:cursor.command+1,character:0});
      else setState('done');
    }, lineDone ? Math.max(0,delayBetweenCommands+(command.runDelayMs ?? 0)) : Math.max(1,typingSpeed));
    return () => clearTimeout(timer);
  }, [state,visible,reduceMotion,commands,cursor,typingSpeed,delayBetweenCommands]);

  useEffect(() => {
    if (copyStatus === 'idle') return;
    const timer = window.setTimeout(() => setCopyStatus('idle'),3000);
    return () => clearTimeout(timer);
  }, [copyStatus]);

  function replay() { started.current=true; setCursor({command:0,character:0}); setState('running'); }
  function toggle() {
    started.current=true;
    if (state === 'running') setState('paused');
    else if (state === 'done') replay();
    else setState('running');
  }
  async function copy() {
    try { await navigator.clipboard.writeText(source); setCopyStatus('copied'); }
    catch { setCopyStatus('error'); setState('done'); }
  }
  const status = complete ? 'All commands shown' : state === 'paused' ? 'Preview paused' : state === 'running' ? 'Typing preview' : 'Command preview';

  return <motion.div ref={root} className={cn('veyrix-terminal',className)} initial={reduceMotion ? false : {opacity:0,y:8}} whileInView={{opacity:1,y:0}} viewport={{once:true,amount:0.15}} transition={{duration:.3}}>
    <div className="terminal-header">
      <div className="terminal-title"><span className="terminal-window-dots" aria-hidden="true"><i/><i/><i/></span><TerminalSquare size={14} aria-hidden="true"/><span>{title}</span></div>
      <div className="terminal-controls">
        {!reduceMotion && <>
          <button type="button" onClick={toggle} aria-label={state === 'running' ? 'Pause command preview' : state === 'done' ? 'Replay command preview' : 'Play command preview'}>{state === 'running' ? <Pause size={13}/> : state === 'done' ? <RotateCcw size={13}/> : <Play size={13}/>}<span>{state === 'running' ? 'Pause' : state === 'done' ? 'Replay' : state === 'paused' ? 'Resume' : 'Play'}</span></button>
          <button type="button" disabled={!!complete} onClick={() => { started.current=true; setState('done'); }}><List size={13}/><span>Show all</span></button>
        </>}
        <button type="button" onClick={copy} aria-label="Copy all commands">{copyStatus === 'copied' ? <Check size={13}/> : <Copy size={13}/>}<span>{copyStatus === 'copied' ? 'Copied' : 'Copy commands'}</span></button>
      </div>
    </div>
    <div className="terminal-body" aria-hidden="true">
      {commands.map((command,index) => {
        const shown = complete || index <= cursor.command;
        const finished = complete || index < cursor.command || (index === cursor.command && cursor.character >= command.input.length);
        const text = complete || index < cursor.command ? command.input : index === cursor.command ? command.input.slice(0,cursor.character) : '';
        return <div className="terminal-command-block" key={index}>
          <div className="terminal-line-reserve"><span className="terminal-prompt">{promptSymbol}</span><code>{command.input}</code></div>
          <div className="terminal-line" style={{visibility:shown ? 'visible' : 'hidden'}}><span className="terminal-prompt">{promptSymbol}</span><code><Syntax text={text}/>{!complete && index === cursor.command && <span className={cn('terminal-cursor',state !== 'running' && 'cursor-paused')}/>}</code></div>
          {command.output?.map((line,i) => <div key={i} className={`terminal-output terminal-output-${typeof line === 'string' ? 'muted' : line.tone ?? 'muted'}`} style={{visibility:finished ? 'visible':'hidden'}}>{typeof line === 'string' ? line : line.text}</div>)}
        </div>;
      })}
    </div>
    <pre className="sr-only" aria-label="Complete command transcript">{fullTranscript}</pre>
    <div className="terminal-status"><span aria-live="polite">{copyStatus === 'error' ? 'Copy unavailable. Select the displayed commands to copy.' : copyStatus === 'copied' ? 'All commands copied.' : status}</span><span>Illustration only · runs nothing</span></div>
  </motion.div>;
}
export default Terminal;
