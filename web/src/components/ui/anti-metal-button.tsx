import { forwardRef, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { cn } from '@/lib/utils';
import './anti-metal-button.css';

type Appearance = { label?: ReactNode; tone?: 'silver' | 'blue' | 'violet' | 'mint'; compact?: boolean; accentFrom?: string; accentTo?: string; dotColor?: string };
const tones = { silver: ['#eeeeee', '#bdbdbd'], blue: ['#a5c8ff', '#729eeb'], violet: ['#d4c0ff', '#ae8de8'], mint: ['#a9ecd8', '#70c6ac'] };
function DoubleChevron({ index }: { index: number }) {
  const dots = [[2,2,0],[5,5,.05],[8,8,.1],[5,11,.15],[2,14,.2],[6,2,.05],[9,5,.1],[12,8,.15],[9,11,.2],[6,14,.25]];
  return <svg width="14" height="16" viewBox="0 0 14 16" aria-hidden="true" focusable="false"><g fill="var(--metal-dot)">{dots.map(([cx,cy,delay],i)=><circle key={i} cx={cx} cy={cy} r="1" className="metal-dot" style={{animationDelay:`${index*.12+delay}s`}}/>)}</g></svg>;
}
function Contents({ children }: { children: ReactNode }) { return <><span className="metal-label">{children}</span><span className="metal-sweep" aria-hidden="true">{[0,1,2,3,4,5,6,7].map(i=><DoubleChevron key={i} index={i}/>)}</span></>; }
function appearance({ tone='silver',accentFrom,accentTo,dotColor='#101010' }: Appearance, style?: CSSProperties): CSSProperties {return { '--metal-from':accentFrom ?? tones[tone][0], '--metal-to':accentTo ?? tones[tone][1], '--metal-dot':dotColor,...style } as CSSProperties;}
export const AntiMetalButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & Appearance>(function AntiMetalButton({label,children,tone,compact,accentFrom,accentTo,dotColor,className,style,type='button',...props},ref) { return <button ref={ref} type={type} className={cn('anti-metal-button',compact && 'metal-compact',className)} style={appearance({tone,accentFrom,accentTo,dotColor},style)} {...props}><Contents>{label ?? children}</Contents></button>; });
export const AntiMetalLink = forwardRef<HTMLAnchorElement, LinkProps & Appearance>(function AntiMetalLink({label,children,tone,compact,accentFrom,accentTo,dotColor,className,style,...props},ref) {return <Link ref={ref} className={cn('anti-metal-button',compact && 'metal-compact',className)} style={appearance({tone,accentFrom,accentTo,dotColor},style)} {...props}><Contents>{label ?? children}</Contents></Link>;});
export default AntiMetalButton;
