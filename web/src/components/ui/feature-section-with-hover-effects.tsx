import type { LucideIcon } from 'lucide-react';
import { Database, MessagesSquare, Star, ShoppingCart, ShieldCheck, PackageCheck, FileUp, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import './feature-section-with-hover-effects.css';

const features: { title: string; description: string; icon: LucideIcon }[] = [
  { title: 'Grounded in your catalog', description: 'Find products using prices and stock read directly from your connected business database.', icon: Database },
  { title: 'Built for conversation', description: 'LangChain and Groq coordinate shopping tools with context from the current session.', icon: MessagesSquare },
  { title: 'Reviews in context', description: 'Explore available product reviews alongside catalog details before making a choice.', icon: Star },
  { title: 'A cart that keeps up', description: 'Add, update, and remove items in a Supabase-backed cart with quantities checked against stock.', icon: ShoppingCart },
  { title: 'People stay in control', description: 'The agent prepares the order. The confirmation button authorizes checkout after address and total review.', icon: ShieldCheck },
  { title: 'Consistent order updates', description: 'Save orders and reduce stock together. Eligible cancellations restore stock once.', icon: PackageCheck },
  { title: 'Return to your conversation', description: 'Save a chat ID and restore its history after a fresh email verification.', icon: FileUp },
  { title: 'Verify before revealing', description: 'Six-digit email codes expire in ten minutes. Customer records are checked for ownership.', icon: Settings2 },
];

export function FeaturesSectionWithHoverEffects() {
  return <div className="veyrix-feature-grid">
    {features.map(({ title, description, icon: Icon }, index) => <article key={title} className={cn('veyrix-hover-feature', index >= 4 && 'feature-gradient-down')}>
      <div className="feature-hover-wash" aria-hidden="true"/>
      <div className="feature-icon"><Icon size={23} strokeWidth={1.6} aria-hidden="true"/></div>
      <h3 className="feature-title"><span className="feature-accent-bar" aria-hidden="true"/><span className="feature-title-text">{title}</span></h3>
      <p className="feature-description">{description}</p>
    </article>)}
  </div>;
}
