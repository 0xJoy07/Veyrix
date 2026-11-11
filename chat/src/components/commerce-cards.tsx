import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowRight, Check, ChevronLeft, Copy, Mail, MapPin, Plus, ShieldCheck } from 'lucide-react';

export type Customer = { id: string; name: string; email: string; phone?: string | null };
export type Address = { id: string; recipient_name: string; phone: string; line1: string; line2?: string; landmark: string; city: string; state: string; pincode: string };
export type AddressInput = Omit<Address, 'id'>;
export type AuthInput = { identifier: string; name?: string; email?: string; phone?: string; purpose: 'login' | 'chat'; chat_id?: string };
export type Challenge = { challenge_id: string; expires_at: string; message: string };
const states = ['Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'];
const phonePattern = '(\\+91 ?)?[6-9][0-9]{9}';
export function Card({ icon, title, description, children }: { icon: ReactNode; title: string; description?: string; children: ReactNode }) {
  return <section className="commerce-card"><div className="commerce-icon" aria-hidden="true">{icon}</div><h3>{title}</h3>{description && <p className="commerce-description">{description}</p>}{children}</section>;
}
export function IdentityCard({ busy, restore = false, onSubmit, onBack }: { busy: boolean; restore?: boolean; onSubmit: (input: AuthInput) => void; onBack?: () => void }) {
  const [newCustomer, setNewCustomer] = useState(false);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const input: AuthInput = { identifier: String(data.get('identifier') || data.get('email') || '').trim(), purpose: restore ? 'chat' : 'login' };
    if (restore) input.chat_id = String(data.get('chat_id') || '').trim();
    if (newCustomer && !restore) { input.name = String(data.get('name') || '').trim(); input.email = String(data.get('email') || '').trim(); input.phone = String(data.get('phone') || '').trim(); }
    onSubmit(input);
  }
  return <Card icon={restore ? <Copy size={20}/> : <ShieldCheck size={22}/>} title={restore ? 'Pick up where you left off.' : 'Let’s make this personal.'} description={restore ? 'Enter your saved chat ID and account email or mobile. We’ll verify access by email before opening the conversation.' : 'Your finds, saved addresses, and conversations—together in one place.'}>
    <form onSubmit={submit} className="commerce-form">
      <fieldset disabled={busy} className="commerce-fields">
        {restore && <label>Chat ID<input name="chat_id" required maxLength={100} placeholder="Paste your saved chat ID" autoComplete="off" /></label>}
        {!newCustomer || restore ? <label>Email or Indian mobile number<input name="identifier" required maxLength={254} autoComplete="username" placeholder="you@example.com or 9876543210" /></label> : <>
          <label>Your full name<input name="name" required minLength={2} maxLength={100} autoComplete="name" placeholder="How should we address you?" /></label>
          <label>Email address<input name="email" type="email" required maxLength={254} autoComplete="email" placeholder="you@example.com" /></label>
          <label>Mobile number<input name="phone" type="tel" inputMode="tel" required pattern={phonePattern} title="Enter a 10-digit Indian mobile number, optionally starting with +91" autoComplete="tel" placeholder="9876543210" /></label>
        </>}
        <button className="commerce-primary" type="submit">{busy ? 'Sending…' : 'Send verification code'}<ArrowRight size={15}/></button>
      </fieldset>
    </form>
    <p className="commerce-note">A six-digit code is sent to your account email. It expires after 10 minutes.</p>
    {!restore && <button type="button" disabled={busy} className="commerce-link" onClick={() => setNewCustomer(!newCustomer)}>{newCustomer ? 'Already shopped with us? Sign in' : 'New to Veyrix? Create your account'}</button>}
    {onBack && <button type="button" disabled={busy} className="commerce-link" onClick={onBack}><ChevronLeft size={14}/>Back to shopping</button>}
  </Card>;
}
export function OtpCard({ challenge, busy, onVerify, onResend, onBack }: { challenge: Challenge; busy: boolean; onVerify: (code: string) => void; onResend: () => void; onBack: () => void }) {
  const [code, setCode] = useState('');
  const [now, setNow] = useState(Date.now());
  useEffect(() => { setCode(''); setNow(Date.now()); const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, [challenge.challenge_id]);
  const seconds = Math.max(0, Math.ceil((new Date(challenge.expires_at).getTime() - now) / 1000));
  const expired = !Number.isFinite(seconds) || seconds === 0;
  return <Card icon={<Mail size={22}/>} title="A little check. Just for you." description={challenge.message || 'Check your email for your Veyrix verification code.'}>
    <form className="commerce-form" onSubmit={event => { event.preventDefault(); if (!expired && /^\d{6}$/.test(code)) onVerify(code); }}>
      <label>Six-digit verification code<input className="otp-input" aria-describedby="otp-expiry" autoFocus value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} placeholder="000000" required disabled={busy || expired}/></label>
      <p id="otp-expiry" className={`commerce-note ${expired ? 'text-red-700' : ''}`}>{expired ? 'This code has expired. Request a new code to continue.' : `Code expires in ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`}</p>
      <button className="commerce-primary" disabled={busy || expired || code.length !== 6}>{busy ? 'Checking…' : 'Verify & continue'}<ShieldCheck size={16}/></button>
    </form>
    <div className="commerce-actions"><button type="button" className="commerce-link" onClick={onResend} disabled={busy}>Send a new code</button><button type="button" className="commerce-link" onClick={onBack} disabled={busy}>Change details</button></div>
    <p className="commerce-note">Only your newest code works. Never share it with anyone.</p>
  </Card>;
}
export function DeliveryCard({ addresses, customer, busy, onSave, onSelect, onClose }: { addresses: Address[]; customer: Customer; busy: boolean; onSave: (address: AddressInput) => Promise<void>; onSelect: (id: string) => void; onClose: () => void }) {
  const [adding, setAdding] = useState(addresses.length === 0);
  const [selected, setSelected] = useState(addresses[0]?.id || '');
  useEffect(() => { if (!addresses.some(address => address.id === selected)) setSelected(addresses[0]?.id || ''); }, [addresses, selected]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries()) as AddressInput;
    try { await onSave(data); setSelected(''); setAdding(false); } catch { /* The parent renders the request error. */ }
  }
  return <Card icon={<MapPin size={22}/>} title="Where should your finds go?" description="Choose a saved address or add a new one. Delivery is available within India.">
    {!adding ? <><fieldset disabled={busy} className="address-options"><legend className="sr-only">Saved delivery addresses</legend>{addresses.map(address => <label key={address.id} className={`address-option ${selected === address.id ? 'selected' : ''}`}><input type="radio" name="delivery-address" value={address.id} checked={selected === address.id} onChange={() => setSelected(address.id)}/><span><strong>{address.recipient_name}</strong><span>{address.line1}{address.line2 ? `, ${address.line2}` : ''}</span><span>Near {address.landmark}</span><span>{address.city}, {address.state} · {address.pincode}</span><span>{address.phone}</span></span></label>)}</fieldset><button type="button" disabled={busy || !selected} onClick={() => onSelect(selected)} className="commerce-primary">Deliver here & review<ArrowRight size={15}/></button><button type="button" disabled={busy} onClick={() => setAdding(true)} className="commerce-link"><Plus size={14}/>Add a new address</button></> : <form className="commerce-form" onSubmit={event => void submit(event)}><fieldset disabled={busy} className="commerce-fields">
      <div className="commerce-grid"><label>Recipient name<input name="recipient_name" defaultValue={customer.name} required minLength={2} maxLength={100} autoComplete="shipping name"/></label><label>Mobile number<input name="phone" defaultValue={customer.phone || ''} required type="tel" inputMode="tel" pattern={phonePattern} title="Enter a valid 10-digit Indian mobile number" autoComplete="shipping tel"/></label></div>
      <label>House / flat, building and street<input name="line1" required minLength={5} maxLength={250} autoComplete="shipping address-line1" placeholder="Flat 12, Green Heights, Park Road"/></label>
      <label>Area / locality <span className="font-normal text-muted-foreground">(optional)</span><input name="line2" maxLength={250} autoComplete="shipping address-line2"/></label>
      <label>Landmark<input name="landmark" required minLength={2} maxLength={150} placeholder="Opposite the community park"/></label>
      <div className="commerce-grid"><label>City<input name="city" required minLength={2} maxLength={100} autoComplete="shipping address-level2"/></label><label>PIN code<input name="pincode" required inputMode="numeric" pattern="[1-9][0-9]{5}" maxLength={6} title="Enter a six-digit Indian PIN code" autoComplete="shipping postal-code"/></label></div>
      <label>State / union territory<select name="state" required defaultValue="" autoComplete="shipping address-level1"><option value="" disabled>Select your state</option>{states.map(state => <option key={state}>{state}</option>)}</select></label>
      <button className="commerce-primary">{busy ? 'Saving…' : 'Save address'}<Check size={15}/></button>
    </fieldset>{addresses.length > 0 && <button type="button" disabled={busy} onClick={() => setAdding(false)} className="commerce-link">Use a saved address</button>}</form>}
    <button type="button" disabled={busy} onClick={onClose} className="commerce-link">Keep shopping</button>
    <p className="commerce-note">Review your total next. Nothing is ordered until you select Confirm order.</p>
  </Card>;
}
export function FarewellCard({ chatId, onNew, busy }: { chatId: string; onNew: () => void; busy: boolean }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  return <Card icon={<Check size={22}/>} title="Until your next great find." description="Your conversation is saved. Keep this chat ID to return later—we’ll verify your email before showing it.">
    <div className="chat-id"><code>{chatId}</code><button aria-label="Copy chat ID" type="button" onClick={() => { if (!navigator.clipboard) { setCopyError(true); return; } void navigator.clipboard.writeText(chatId).then(() => { setCopied(true); setCopyError(false); }).catch(() => setCopyError(true)); }}><Copy size={16}/></button></div>
    <p role="status" className="commerce-note">{copied ? 'Chat ID copied.' : copyError ? 'Select the chat ID above to copy it.' : 'Thank you for shopping with Veyrix.'}</p>
    <button type="button" className="commerce-primary" onClick={onNew} disabled={busy}>Start a fresh conversation<ArrowRight size={15}/></button>
  </Card>;
}
export function ProfileCard({ customer, busy, onSave }: { customer: Customer; busy: boolean; onSave: (profile: { name: string; phone: string }) => void }) {
  return <Card icon={<ShieldCheck size={22}/>} title="One last introduction." description="Your email is verified. Add your name and Indian mobile number so we can set up your shopping profile.">
    <form className="commerce-form" onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); onSave({ name: String(data.get('name') || '').trim(), phone: String(data.get('phone') || '').trim() }); }}><fieldset disabled={busy} className="commerce-fields">
      <label>Your full name<input name="name" required minLength={2} maxLength={100} autoComplete="name" defaultValue={customer.name === 'Customer' ? '' : customer.name}/></label>
      <label>Mobile number<input name="phone" type="tel" inputMode="tel" required pattern={phonePattern} title="Enter a 10-digit Indian mobile number, optionally starting with +91" autoComplete="tel" defaultValue={customer.phone || ''}/></label>
      <button className="commerce-primary">{busy ? 'Saving…' : 'Let’s start shopping'}<ArrowRight size={15}/></button>
    </fieldset></form>
  </Card>;
}
