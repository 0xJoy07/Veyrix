import { GitHubRepoButton } from '@/components/ui/github-repo-button';
import { REPOSITORY_URL } from '@/content/repository';
import HalftoneWordmarkFooter from '@/components/ui/halftone-wordmark-footer';
import { AntiMetalLink } from '@/components/ui/anti-metal-button';
import { useEffect, useRef, useState } from 'react';
import { BrowserRouter, Link, Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Github, Menu, X } from 'lucide-react';
import RoutePage from '@/components/route-page';
const loadHome = () => import('@/pages/Home');
const loadOverview = () => import('@/pages/Overview');
const loadArchitecture = () => import('@/pages/Architecture');
const loadQuickstart = () => import('@/pages/Quickstart');
const loadStatus = () => import('@/pages/Status');
const titles: Record<string,string> = {'/':'Commerce, in conversation.','/docs':'Documentation','/docs/quickstart':'Getting started','/architecture':'Architecture','/status':'Project status'};
function Layout() {
  const { pathname } = useLocation();
  const [menu, setMenu] = useState(false);
  const main = useRef<HTMLElement>(null);
  const header = useRef<HTMLElement>(null);
  const menuToggle = useRef<HTMLButtonElement>(null);
  const previousPath = useRef(pathname);
  useEffect(() => {
    document.title = `Veyrix — ${titles[pathname] ?? 'Page not found'}`;
    setMenu(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (previousPath.current !== pathname) main.current?.focus({preventScroll:true});
    previousPath.current = pathname;
  }, [pathname]);
  useEffect(() => {
    if (!menu) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMenu(false); menuToggle.current?.focus(); }
    };
    const outside = (event: PointerEvent) => {
      if (!header.current?.contains(event.target as Node)) setMenu(false);
    };
    const desktop = window.matchMedia('(min-width: 1101px)');
    const resize = () => { if (desktop.matches) setMenu(false); };
    document.addEventListener('keydown', dismiss);
    document.addEventListener('pointerdown', outside);
    desktop.addEventListener('change', resize);
    return () => {
      document.removeEventListener('keydown', dismiss);
      document.removeEventListener('pointerdown', outside);
      desktop.removeEventListener('change', resize);
    };
  }, [menu]);
  return <div className={pathname === '/' ? 'home-layout' : 'inner-layout'}>
    <a className="page-skip" href="#main-content">Skip to content</a>
    <header className="site-header" ref={header}><Link className="brand" to="/" aria-label="Veyrix home"><span className="brand-symbol">V</span>veyrix<span className="brand-divider"/><span className="brand-docs">GIVE YOUR ONLINE BUSINESS LIFE</span></Link><button ref={menuToggle} type="button" className="menu-toggle" aria-label={menu ? 'Close navigation' : 'Open navigation'} aria-expanded={menu} aria-controls="main-nav" onClick={() => setMenu(!menu)}>{menu ? <X/> : <Menu/>}</button><nav id="main-nav" className={menu ? 'main-nav open' : 'main-nav'} aria-label="Main navigation" onClick={() => setMenu(false)}><NavLink to="/" end>Home</NavLink><NavLink to="/docs">Documentation</NavLink><NavLink to="/architecture">Architecture</NavLink><NavLink to="/status">Project status</NavLink><div className="nav-actions"><GitHubRepoButton compact/><AntiMetalLink compact to="/docs/quickstart">Get started</AntiMetalLink></div></nav></header>
    <main id="main-content" tabIndex={-1} ref={main}><Outlet/></main>
    {pathname === '/' ? <HalftoneWordmarkFooter
      className="veyrix-wordmark-footer"
      wordmark="veyrix"
      label="Veyrix / Conversational commerce"
      meta="Local prototype. Real possibilities."
      palette={{ background: '#000000', ink: '#d6d6d6', warm: '#9daeff' }}
      grain={0.18}
      dotGap={6}
      crop={0.16}
      radius={90}
      height="clamp(560px, 44vw, 800px)"
      fontFamily="Inter Variable, sans-serif"
    /> : <footer className="site-footer"><Link className="brand" to="/"><span className="brand-symbol">V</span>veyrix</Link><p>Conversational commerce, connected to your business.</p><div className="site-footer-links"><a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer" aria-label="Veyrix repository on GitHub (opens in a new tab)"><Github size={15} aria-hidden="true"/>GitHub repository</a><Link to="/status">Local prototype <span className="footer-dot"/></Link></div></footer>}
  </div>;
}
function DocsLayout() { return <><nav className="docs-nav" aria-label="Documentation sections"><NavLink end to="/docs">Overview</NavLink><NavLink to="/docs/quickstart">Quickstart</NavLink></nav><Outlet/></>; }
function NotFound() { return <section className="section-pad not-found"><p className="kicker">404 / PAGE NOT FOUND</p><h1>This page isn’t here.</h1><p>Find your way back to Veyrix or explore the documentation.</p><AntiMetalLink to="/">Back to home</AntiMetalLink></section>; }
export default function App() { return <BrowserRouter><Routes><Route element={<Layout/>}><Route index element={<RoutePage load={loadHome}/>}/><Route path="docs" element={<DocsLayout/>}><Route index element={<RoutePage load={loadOverview}/>}/><Route path="quickstart" element={<RoutePage load={loadQuickstart}/>}/></Route><Route path="architecture" element={<RoutePage load={loadArchitecture}/>}/><Route path="docs/architecture" element={<Navigate to="/architecture" replace/>}/><Route path="status" element={<RoutePage load={loadStatus}/>}/><Route path="*" element={<NotFound/>}/></Route></Routes></BrowserRouter>; }
