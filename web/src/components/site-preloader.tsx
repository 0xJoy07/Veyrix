import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { NeonHello } from '@/components/ui/neon-hello';
import './site-preloader.css';

const TUBE_COLORS = ['#d6d6d6', '#f5f5f5', '#9daeff', '#bbbbbb', '#e8e8e8'];
const FRAME_COLORS = ['#9daeff', '#777777', '#d6d6d6', '#777777'];
// Preserve the supplied drawing: 2.67s write + brief hold + 350ms exit.
const INTRO_MS = 3200;
const EXIT_MS = 350;

class IntroBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}

/** A short arrival, mounted once outside the router while the actual page loads underneath. */
export default function SitePreloader({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<'intro' | 'leaving' | 'done'>(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'done' : 'intro');
  const overlay = useRef<HTMLDivElement>(null);
  const finish = useCallback(() => setPhase('done'), []);
  const showing = phase !== 'done';

  useEffect(() => {
    if (!showing) return;
    const originalOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = 'hidden';
    overlay.current?.focus({ preventScroll: true });
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => { if (preference.matches) finish(); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') finish(); };
    preference.addEventListener('change', change);
    document.addEventListener('keydown', escape);
    return () => {
      document.body.style.overflow = originalOverflow;
      preference.removeEventListener('change', change);
      document.removeEventListener('keydown', escape);
      if (previousFocus instanceof HTMLElement && previousFocus !== document.body && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      } else document.getElementById('main-content')?.focus({ preventScroll: true });
    };
  }, [showing, finish]);

  useEffect(() => {
    if (phase === 'done') return;
    const timer = window.setTimeout(phase === 'intro' ? () => setPhase('leaving') : finish,
      phase === 'intro' ? INTRO_MS : EXIT_MS + 50);
    return () => window.clearTimeout(timer);
  }, [phase, finish]);

  return <>
    <div inert={showing} aria-hidden={showing || undefined}>{children}</div>
    {showing && <div ref={overlay} tabIndex={-1} className="site-preloader t-panel-slide" data-open={phase === 'intro'}
      role="dialog" aria-modal="true" aria-label="Welcome to Veyrix"
      onTransitionEnd={event => {
        if (event.target === event.currentTarget && event.propertyName === 'opacity' && phase === 'leaving') finish();
      }}>
      <IntroBoundary onFailure={finish}>
        <NeonHello word="hello" label="hello. Welcome to Veyrix" colors={TUBE_COLORS} frame={FRAME_COLORS}
          loop={false} speed={1.5} scale={0.68} interactive={false}>
          <p className="site-preloader-welcome">WELCOME TO VEYRIX</p>
        </NeonHello>
      </IntroBoundary>
    </div>}
  </>;
}
