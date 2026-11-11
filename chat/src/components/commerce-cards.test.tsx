import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConfirmationCard } from './confirmation-card';
import { DeliveryCard, IdentityCard, OtpCard, ProfileCard } from './commerce-cards';

const customer = { id: 'customer-1', name: 'Aditi Rao', email: 'aditi@example.test', phone: '+919876543210' };
const address = { id: 'address-1', recipient_name: 'Aditi Rao', phone: '+919876543210', line1: 'Flat 12, Green Heights', line2: 'Park Road', landmark: 'Community park', city: 'Kolkata', state: 'West Bengal', pincode: '700001' };
const summary = { items: [{ id: 'shoe-1', name: 'Walking shoes', quantity: 2, price_minor: 129900 }], delivery: address, address: 'Legacy address', total_minor: 264800, delivery_minor: 5000, currency: 'INR' };
const render = (pending: unknown, isLoading = false) => renderToStaticMarkup(createElement(ConfirmationCard, { pending, isLoading, onConfirm() {} }));

test('order review shows full structured delivery details and exact total before confirmation', () => {
  const html = render({ token: 'confirmation-1', kind: 'order', summary });
  for (const value of ['Walking shoes', '× 2', '₹2,598.00', '₹50.00', '₹2,648.00', 'Aditi Rao', '+919876543210', 'Flat 12, Green Heights', 'Park Road', 'Landmark:', 'Community park', 'Kolkata, West Bengal', '700001', 'India', 'Payment on delivery', 'Confirm order']) assert.ok(html.includes(value), value);
  assert.ok(!html.includes('Legacy address'));
  assert.match(html, /tabindex="0" role="region" aria-label="Review pending action"/);
  assert.ok(!/\/confirm|\/orders/.test(html));
});
test('cancellation review supports database order items and shows ID, quantity and total', () => {
  const html = render({ token: 'cancel-1', kind: 'cancel', order_id: 'order-42', summary: { items: [{ id: 'order-item-1', product_id: 'shoe-1', name: 'Walking shoes', quantity: 2, price_minor: 129900 }], total_minor: 264800, currency: 'INR' } });
  for (const value of ['order-42', 'Walking shoes', '× 2', '₹2,598.00', '₹2,648.00', 'before dispatch', 'Confirm cancellation']) assert.ok(html.includes(value), value);
  assert.ok(!html.includes('Deliver to'));
});
test('confirmation requires a server token and is disabled during a request; text is escaped', () => {
  assert.equal(render({ kind: 'order', summary }), '');
  const html = render({ token: 'one', kind: 'order', summary: { ...summary, items: [{ id: 'unsafe', name: '<img src=x onerror=alert(1)>', quantity: 1, price_minor: 100 }] } }, true);
  assert.match(html, /button type="button" disabled=""/);
  assert.ok(html.includes('&lt;img'));
  assert.ok(!html.includes('<img'));
});
test('new delivery form requires recipient, mobile, landmark, city, PIN and state', () => {
  const html = renderToStaticMarkup(createElement(DeliveryCard, { addresses: [], customer, busy: false, async onSave() {}, onSelect() {}, onClose() {} }));
  for (const field of ['recipient_name', 'phone', 'line1', 'landmark', 'city', 'pincode', 'state']) assert.match(html, new RegExp(`(?:input|select)(?=[^>]*name="${field}")(?=[^>]*required="")[^>]*`));
  assert.match(html, /pattern="\[1-9\]\[0-9\]\{5\}"/);
  assert.ok(html.includes('Delivery is available within India'));
});
test('expired OTP cannot be submitted and offers resend; account forms have accessible labels', () => {
  const html = renderToStaticMarkup(createElement(OtpCard, { challenge: { challenge_id: 'challenge', expires_at: new Date(Date.now() - 1000).toISOString(), message: 'Check your email.' }, busy: false, onVerify() {}, onResend() {}, onBack() {} }));
  assert.ok(html.includes('This code has expired'));
  assert.ok(html.includes('Send a new code'));
  assert.match(html, /button class="commerce-primary" disabled=""/);
  const identity = renderToStaticMarkup(createElement(IdentityCard, { busy: false, onSubmit() {} }));
  assert.ok(identity.includes('Email or Indian mobile number'));
  const profile = renderToStaticMarkup(createElement(ProfileCard, { customer, busy: false, onSave() {} }));
  assert.ok(profile.includes('Your full name'));
  assert.ok(profile.includes('Mobile number'));
});
