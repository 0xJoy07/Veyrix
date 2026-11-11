import { Check } from 'lucide-react';

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function text(value: unknown) { return typeof value === 'string' ? value : ''; }
function money(value: unknown, currency: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Unavailable';
  const code = typeof currency === 'string' ? currency : 'INR';
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: code }).format(value / 100); }
  catch { return `${code} ${(value / 100).toFixed(2)}`; }
}
export function ConfirmationCard({ pending, isLoading = false, onConfirm }: { pending: unknown; isLoading?: boolean; onConfirm?: () => void }) {
  const action = record(pending);
  if (!text(action?.token) || !onConfirm) return null;
  const cancellation = action?.kind === 'cancel';
  const summary = record(action?.summary);
  const delivery = record(summary?.delivery);
  const items = Array.isArray(summary?.items) ? summary.items.map(record).filter((item): item is Record<string, unknown> => item !== null) : [];
  return <section aria-label={cancellation ? 'Cancellation confirmation' : 'Order confirmation'} className="mb-3 min-w-0 rounded-2xl border border-border bg-neutral-50 p-3 dark:bg-neutral-900">
    <h3 className="text-sm font-medium">{cancellation ? 'Confirm cancellation' : 'Ready to place your order?'}</h3>
    <div tabIndex={0} role="region" aria-label="Review pending action" className="mt-2 max-h-56 space-y-3 overflow-y-auto overscroll-contain pr-1 text-xs leading-5 [overflow-wrap:anywhere] focus-visible:outline-2 focus-visible:outline-offset-2">
      {cancellation && <p>Order ID: <span className="font-medium">{text(action?.order_id) || text(summary?.order_id) || 'Unavailable'}</span></p>}
      {items.length > 0 && <ul aria-label={cancellation ? 'Items to cancel' : 'Order items'} className="space-y-2">
        {items.map((item, index) => <li key={`${text(item.product_id) || text(item.id) || 'item'}-${index}`} className="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-0.5">
          <span className="min-w-0 flex-1 basis-32">{text(item.name) || 'Item'} <span className="text-muted-foreground">× {typeof item.quantity === 'number' ? item.quantity : '?'}</span></span>
          <span className="shrink-0 tabular-nums">{money(typeof item.price_minor === 'number' && typeof item.quantity === 'number' ? item.price_minor * item.quantity : null, summary?.currency)}</span>
        </li>)}
      </ul>}
      {!cancellation && <div className="flex flex-wrap justify-between gap-x-3 text-muted-foreground"><span>Delivery</span><span>{money(summary?.delivery_minor, summary?.currency)}</span></div>}
      <div className="flex flex-wrap justify-between gap-x-3 border-t border-border pt-2 font-medium"><span>{cancellation ? 'Order total' : 'Total'} ({text(summary?.currency) || 'INR'})</span><span>{money(summary?.total_minor, summary?.currency)}</span></div>
      {cancellation ? <p className="text-muted-foreground">Cancellation is available only before dispatch. We’ll check the order status again when you confirm.</p> : <>
        <div><p className="font-medium">Deliver to</p>{delivery ? <address className="mt-1 not-italic">
          <p>{text(delivery.recipient_name)}</p><p>{text(delivery.phone)}</p><p>{text(delivery.line1)}</p>{text(delivery.line2) && <p>{text(delivery.line2)}</p>}
          <p><span className="font-medium">Landmark: </span>{text(delivery.landmark)}</p>
          <p>{[text(delivery.city), text(delivery.state)].filter(Boolean).join(', ')} · {text(delivery.pincode)}</p><p>India</p>
        </address> : <p>{text(summary?.address) || 'Unavailable'}</p>}</div>
        <p className="text-muted-foreground">Payment on delivery</p>
      </>}
    </div>
    <button type="button" disabled={isLoading} onClick={onConfirm} className="mt-3 flex min-h-10 items-center gap-2 rounded-full bg-neutral-950 px-4 py-2 text-xs font-medium text-white disabled:opacity-40 dark:bg-white dark:text-neutral-950"><Check className="h-3.5 w-3.5" aria-hidden="true"/>{cancellation ? 'Confirm cancellation' : 'Confirm order'}</button>
  </section>;
}
