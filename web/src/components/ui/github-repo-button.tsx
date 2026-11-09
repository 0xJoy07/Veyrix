'use client';

import { useEffect, useRef, useState, type AnchorHTMLAttributes } from 'react';
import { useInView } from 'framer-motion';
import { ArrowUpRight, Github } from 'lucide-react';
import { Liquid, type Colors } from '@/components/ui/button-1';
import { REPOSITORY_URL } from '@/content/repository';
import { cn } from '@/lib/utils';
import './github-repo-button.css';

const COLORS: Colors = {
  color1: '#e3e8ff', color2: '#3c467f', color3: '#929bcd',
  color4: '#f0f2ff', color5: '#c7cce6', color6: '#9da9dc',
  color7: '#4b609c', color8: '#536aa8', color9: '#7969b4',
  color10: '#a89dd0', color11: '#384876', color12: '#c2c6e3',
  color13: '#594f96', color14: '#b2b6df', color15: '#bdc5e4',
  color16: '#6661a5', color17: '#889ad2',
};

export type GitHubRepoButtonProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'target' | 'rel' | 'children'> & {
  compact?: boolean;
  label?: string;
};

/** A repository link, not a star action: the artwork is purely decorative. */
export function GitHubRepoButton({ compact = false, label = 'GitHub', className, onPointerEnter, onPointerLeave, onFocus, onBlur, ...props }: GitHubRepoButtonProps) {
  const root = useRef<HTMLAnchorElement>(null);
  const inView = useInView(root);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  useEffect(() => {
    const update = () => setPageVisible(document.visibilityState !== 'hidden');
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return <a {...props} ref={root} href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer"
    className={cn('github-repo-button', compact && 'github-repo-compact', className)}
    aria-label={props['aria-label'] ?? `${label} — Veyrix repository on GitHub (opens in a new tab)`}
    onPointerEnter={event => { if (event.pointerType !== 'touch') setHovered(true); onPointerEnter?.(event); }}
    onPointerLeave={event => { setHovered(false); onPointerLeave?.(event); }}
    onFocus={event => { setFocused(true); onFocus?.(event); }}
    onBlur={event => { setFocused(false); onBlur?.(event); }}>
    <span className="github-repo-artwork" aria-hidden="true"><span className="github-repo-glow"/><Liquid isHovered={(hovered || focused) && inView && pageVisible} colors={COLORS}/><span className="github-repo-shade"/></span>
    <span className="github-repo-label"><Github size={17} aria-hidden="true"/><span>{label}</span><ArrowUpRight className="github-repo-external" size={14} aria-hidden="true"/></span>
  </a>;
}

export default GitHubRepoButton;
