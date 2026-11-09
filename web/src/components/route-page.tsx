import { Component, lazy, Suspense, useMemo, type ComponentType, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { AntiMetalButton } from '@/components/ui/anti-metal-button';

type PageLoader = () => Promise<{ default: ComponentType }>;
export function RouteSkeleton({ path }: { path: string }) {
  const home = path === '/';
  const pipeline = path.includes('architecture');
  return <div className={`route-skeleton ${home ? 'skeleton-home' : ''}`} role="status" aria-live="polite" aria-busy="true">
    <span className="sr-only">Loading page…</span>
    <div aria-hidden="true">
      <div className="skeleton-bar skeleton-eyebrow"/>
      <div className="skeleton-bar skeleton-title"/><div className="skeleton-bar skeleton-title skeleton-short"/>
      <div className="skeleton-bar skeleton-copy"/><div className="skeleton-bar skeleton-copy skeleton-short"/>
      {pipeline || home ? <div className="skeleton-panel"><div className="skeleton-bar skeleton-eyebrow"/><div className="skeleton-nodes">{[0,1,2].map(i=><div className="skeleton-bar skeleton-node" key={i}/>)}</div></div> : <div className="skeleton-sections">{[0,1,2].map(i=><div className="skeleton-section" key={i}><div className="skeleton-bar skeleton-eyebrow"/><div className="skeleton-bar skeleton-copy"/><div className="skeleton-bar skeleton-copy skeleton-short"/></div>)}</div>}
    </div>
  </div>;
}
class PageLoadBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <section className="section-pad"><h1>This page couldn’t load.</h1><p>Please reload to try again.</p><AntiMetalButton onClick={() => window.location.reload()}>Reload page</AntiMetalButton></section> : this.props.children; }
}
export default function RoutePage({ load }: { load: PageLoader }) {
  const { pathname, key } = useLocation();
  const Page = useMemo(() => lazy(async () => {
    // Load the route immediately, with a brief minimum reveal interval on every navigation.
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220;
    const [module] = await Promise.all([load(), new Promise(resolve => setTimeout(resolve, delay))]);
    return module;
  }), [load, key]);
  return <PageLoadBoundary key={key}><Suspense fallback={<RouteSkeleton path={pathname}/>}><div className="route-content" key={key}><Page/></div></Suspense></PageLoadBoundary>;
}
