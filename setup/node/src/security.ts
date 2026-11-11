import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

export const OTP_TTL_MS = 10 * 60 * 1000;
export const MAX_OTP_ATTEMPTS = 5;
export const AUTH_TTL_MS = 30 * 60 * 1000;
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function token() { return randomBytes(32).toString('hex'); }
export function hash(value: string) { return createHash('sha256').update(value).digest('hex'); }
export function digest(secret: string, value: string) { return createHmac('sha256', secret).update(value).digest('hex'); }
export function equal(a: string, b: string) {
  const aa = Buffer.from(a), bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
export function generateOtp() { return randomInt(0, 1_000_000).toString().padStart(6, '0'); }
export function validOtp(record: {code_hash:string;expires_at:Date;consumed_at:Date|null;attempts:number}, code: string, secret: string, id: string, now = new Date()) {
  return /^\d{6}$/.test(code) && !record.consumed_at && record.attempts < MAX_OTP_ATTEMPTS && record.expires_at.getTime() > now.getTime() && equal(record.code_hash, digest(secret, `${id}:${code}`));
}
export const emailSchema = z.string().trim().email().max(254).transform(v => v.toLowerCase());
export function normalizePhone(value: string) {
  let number = value.replace(/[\s()-]/g, '');
  if (number.startsWith('+91')) number = number.slice(3);
  else if (number.length === 12 && number.startsWith('91')) number = number.slice(2);
  else if (number.length === 11 && number.startsWith('0')) number = number.slice(1);
  if (!/^[6-9]\d{9}$/.test(number)) throw new ApiError(400, 'invalid_phone', 'Enter a valid 10-digit Indian mobile number.');
  return `+91${number}`;
}
export const STATES = ['Andaman and Nicobar Islands','Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chandigarh','Chhattisgarh','Dadra and Nagar Haveli and Daman and Diu','Delhi','Goa','Gujarat','Haryana','Himachal Pradesh','Jammu and Kashmir','Jharkhand','Karnataka','Kerala','Ladakh','Lakshadweep','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Puducherry','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal'];
const text = (max: number) => z.string().trim().min(2).max(max);
export const addressSchema = z.object({recipient_name:text(250),phone:z.string().transform(normalizePhone),line1:text(300),line2:z.string().trim().max(300).optional().default(''),landmark:text(250),city:text(100),state:z.string().refine(v => STATES.includes(v),'Choose an Indian state or union territory.'),pincode:z.string().regex(/^[1-9]\d{5}$/, 'Enter a six-digit Indian PIN code.')}).strict();
export type DeliveryAddress = z.infer<typeof addressSchema>;
export const canCancel = (status: string) => ['confirmed', 'preparing'].includes(status);
