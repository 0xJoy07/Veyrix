import type { LucideIcon } from 'lucide-react';
import { Database, MessagesSquare, Star, ShoppingCart, ShieldCheck, PackageCheck, FileUp, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import './feature-section-with-hover-effects.css';

const features: { title: string; description: string; icon: LucideIcon }[] = [
  { title: 'Grounded in your catalog', description: 'Find products using prices and stock read directly from your connected business database.', icon: Database },
  { title: 'Built for conversation', description: 'LangChain and Groq coordinate shopping tools with context from the current session.', icon: MessagesSquare },
  { title: 'Reviews in context', description: 'Explore available product reviews alongside catalog details before making a choice.', icon: Star },
  { title: 'A cart that keeps up', description: 'Add, update, and remove items in a temporary cart with quantities checked against stock.', icon: ShoppingCart },
  { title: 'People stay in control', description: 'The agent prepares the order. An explicit customer confirmation authorizes the purchase.', icon: ShieldCheck },
  { title: 'Consistent order updates', description: 'Save orders and reduce stock together. Eligible cancellations restore stock once.', icon: PackageCheck },
  { title: 'Bring your product data', description: 'Import CSV or JSON records, or map an existing product table for catalog reads.', icon: FileUp },
  { title: 'Configure your business', description: 'Set up database connections, the Groq model, and store settings through the local setup tool.', icon: Settings2 },
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
