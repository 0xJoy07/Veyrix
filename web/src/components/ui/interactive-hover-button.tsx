import { forwardRef, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link, type LinkProps } from 'react-router-dom';
import { cn } from '@/lib/utils';
import './interactive-hover-button.css';

export type InteractiveHoverAppearance = {
  text?: string;
  children?: ReactNode;
  tone?: 'silver' | 'blue' | 'violet' | 'mint';
  compact?: boolean;
  accentFrom?: string;
  accentTo?: string;
  dotColor?: string;
};

export type InteractiveHoverButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & InteractiveHoverAppearance;
export type InteractiveHoverLinkProps = LinkProps & InteractiveHoverAppearance;

const tones = {
  silver: ['#eeeeee', '#c9c9d0'],
  blue: ['#b4ccff', '#91aff1'],
  violet: ['#d4c3ff', '#b8a0ef'],
  mint: ['#b2e9da', '#8ed5bd'],
} as const;

function appearance({ tone = 'silver', accentFrom, accentTo, dotColor = '#101116' }: InteractiveHoverAppearance, style?: CSSProperties): CSSProperties {
  return {
    '--hover-accent': accentFrom ?? tones[tone][0],
    '--hover-accent-end': accentTo ?? tones[tone][1],
    '--hover-active-ink': dotColor,
    ...style,
  } as CSSProperties;
}

function Contents({ children }: { children: ReactNode }) {
  return <>
    <span className="hover-fill" aria-hidden="true"/>
    <span className="hover-label">{children}</span>
    <span className="hover-active" aria-hidden="true"><span>{children}</span><ArrowRight size={16} strokeWidth={1.8}/></span>
  </>;
}

/** The supplied expanding-dot interaction, sized to its real label instead of a fixed width. */
export const InteractiveHoverButton = forwardRef<HTMLButtonElement, InteractiveHoverButtonProps>(function InteractiveHoverButton(
  { text, children, tone, compact, accentFrom, accentTo, dotColor, className, style, type = 'button', ...props }, ref,
) {
  return <button
    ref={ref}
    type={type}
    className={cn('interactive-hover-button', compact && 'hover-compact', className)}
    style={appearance({ tone, accentFrom, accentTo, dotColor }, style)}
    {...props}
  ><Contents>{children ?? text ?? 'Button'}</Contents></button>;
});

/** Navigation remains a real link, with the same visual interaction as the button. */
export const InteractiveHoverLink = forwardRef<HTMLAnchorElement, InteractiveHoverLinkProps>(function InteractiveHoverLink(
  { text, children, tone, compact, accentFrom, accentTo, dotColor, className, style, ...props }, ref,
) {
  return <Link
    ref={ref}
    className={cn('interactive-hover-button', compact && 'hover-compact', className)}
    style={appearance({ tone, accentFrom, accentTo, dotColor }, style)}
    {...props}
  ><Contents>{children ?? text ?? 'Button'}</Contents></Link>;
});

InteractiveHoverButton.displayName = 'InteractiveHoverButton';
InteractiveHoverLink.displayName = 'InteractiveHoverLink';

export default InteractiveHoverButton;
