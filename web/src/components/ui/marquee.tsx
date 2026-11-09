"use client";
import React from 'react';
import { cn } from '@/lib/utils';
import './marquee.css';

export interface MarqueeProps extends React.HTMLAttributes<HTMLDivElement> {
  duration?: number;
  pauseOnHover?: boolean;
  direction?: 'left' | 'right' | 'up' | 'down';
  fade?: boolean;
  fadeAmount?: number;
  paused?: boolean;
}
/** Two equal groups form a seamless loop; only the first is exposed to assistive tools. */
export function Marquee({children,className,duration=20,pauseOnHover=false,direction='left',fade=true,fadeAmount=10,paused=false,style,...props}:MarqueeProps) {
  const vertical = direction === 'up' || direction === 'down';
  const edge = Math.min(49,Math.max(0,fadeAmount));
  const mask = fade ? `linear-gradient(to ${vertical ? 'bottom' : 'right'}, transparent, black ${edge}%, black ${100-edge}%, transparent)` : undefined;
  return <div {...props} className={cn('veyrix-marquee',className)} data-vertical={vertical} data-reverse={direction === 'right' || direction === 'down'} data-hover-pause={pauseOnHover} data-paused={paused} style={{'--marquee-duration':`${Math.max(1,duration)}s`,maskImage:mask,WebkitMaskImage:mask,...style} as React.CSSProperties}>
    <div className="marquee-track"><div className="marquee-group">{children}</div><div className="marquee-group marquee-copy" aria-hidden="true" inert>{children}</div></div>
  </div>;
}
