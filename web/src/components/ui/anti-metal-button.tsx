import { forwardRef, type ReactNode } from 'react';
import { InteractiveHoverButton, InteractiveHoverLink, type InteractiveHoverButtonProps, type InteractiveHoverLinkProps } from './interactive-hover-button';

// Keep existing CTA call sites compatible while their visual treatment moves
// to the supplied expanding-dot button. Chapter and playback controls are separate.
export const AntiMetalButton = forwardRef<HTMLButtonElement, InteractiveHoverButtonProps & { label?: ReactNode }>(function AntiMetalButton({ label, children, ...props }, ref) {
  return <InteractiveHoverButton ref={ref} {...props}>{label ?? children}</InteractiveHoverButton>;
});
export const AntiMetalLink = forwardRef<HTMLAnchorElement, InteractiveHoverLinkProps & { label?: ReactNode }>(function AntiMetalLink({ label, children, ...props }, ref) {
  return <InteractiveHoverLink ref={ref} {...props}>{label ?? children}</InteractiveHoverLink>;
});
export default AntiMetalButton;
