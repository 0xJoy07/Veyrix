import { useEffect, useId, useState, type ReactNode } from 'react';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export type SectionLink = { id: string; label: string };

export function OnThisPage({ sections }: { sections: SectionLink[] }) {
  const [active, setActive] = useState(sections[0]?.id);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      let current = sections[0]?.id;
      for (const section of sections) {
        if ((document.getElementById(section.id)?.getBoundingClientRect().top ?? Infinity) <= 170) current = section.id;
      }
      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4) {
        current = sections.at(-1)?.id ?? current;
      }
      setActive(current);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    let hash = '';
    try { hash = decodeURIComponent(window.location.hash.slice(1)); } catch { /* Ignore malformed external fragments. */ }
    if (sections.some(section => section.id === hash)) {
      frame = requestAnimationFrame(() => { document.getElementById(hash)?.scrollIntoView(); update(); });
    } else update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  }, [sections]);

  return <aside className="doc-rail"><nav aria-label="On this page"><p className="doc-overline">On this page</p>{sections.map((section, index) => <a key={section.id} href={`#${section.id}`} aria-current={active === section.id ? 'location' : undefined} onClick={event => {
    event.preventDefault();
    const target = document.getElementById(section.id);
    target?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    target?.focus({ preventScroll: true });
  }}><span>{String(index + 1).padStart(2, '0')}</span>{section.label}</a>)}</nav><div className="doc-rail-note">Veyrix field guide<br/><span>Local engine · Python 3.12</span></div></aside>;
}

export function DocumentSection({ id, number, title, description, children }: { id: string; number: string; title: string; description?: string; children: ReactNode }) {
  return <section className="doc-section" id={id} tabIndex={-1} aria-labelledby={`${id}-heading`}><div className="doc-section-title"><span className="doc-section-number">{number}</span><div><h2 id={`${id}-heading`}>{title}</h2>{description && <p>{description}</p>}</div></div>{children}</section>;
}

export function Disclosure({ title, children, defaultOpen = false, badge }: { title: string; children: ReactNode; defaultOpen?: boolean; badge?: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return <div className="t-acc doc-disclosure" data-open={open}><h3><button type="button" id={`${id}-trigger`} className="t-acc-head" aria-expanded={open} aria-controls={`${id}-panel`} onClick={() => setOpen(!open)}><span>{title}</span>{badge}<span className="t-acc-chevron" aria-hidden="true"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6.5L8 10.5L12 6.5"/></svg></span></button></h3><div className="t-acc-panel" id={`${id}-panel`} role="region" aria-labelledby={`${id}-trigger`} aria-hidden={!open} inert={!open}><div className="t-acc-panel-inner"><div className="doc-disclosure-content">{children}</div></div></div></div>;
}

export function DocCallout({ title, children, tone = 'blue' }: { title: string; children: ReactNode; tone?: 'blue' | 'violet' | 'mint' }) {
  return <aside className={`doc-callout doc-tone-${tone}`}><span className="doc-callout-mark" aria-hidden="true"/><div><strong>{title}</strong><div>{children}</div></div></aside>;
}

export function ReadingLink({ to, label, title, children }: { to: string; label: string; title: string; children: ReactNode }) {
  return <Link to={to} className="doc-reading-link"><span className="doc-overline">{label}<ArrowUpRight size={16}/></span><h3>{title}</h3><p>{children}</p><span className="doc-link-action">Continue reading <ArrowRight size={16}/></span></Link>;
}
