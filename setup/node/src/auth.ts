import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { AuthSession } from '@prisma/client';
import type { Config } from './config.js';
import { ApiError, AUTH_TTL_MS, OTP_TTL_MS, MAX_OTP_ATTEMPTS, digest, emailSchema, generateOtp, hash, normalizePhone, token, validOtp } from './security.js';
import { db, transaction, json, jsonData } from './store.js';
import { sendOtpEmail, validSender } from './email.js';

export const startSchema = z.object({identifier:z.string().trim().min(3).max(254),name:z.string().trim().min(2).max(250).optional(),email:emailSchema.optional(),phone:z.string().transform(normalizePhone).optional(),purpose:z.enum(['login','chat']).default('login'),chat_id:z.string().uuid().optional()}).strict();
export async function startAuth(body: unknown, ip: string, config: Config) {
  if (!config.resendApiKey || !validSender(config.resendFrom) || config.resendFrom.includes('YOUR_VERIFIED_DOMAIN')) throw new ApiError(503,'email_not_configured','Email verification is not configured yet. Set the Resend API key and verified sender address on the server.');
  const input = startSchema.parse(body);
  if (input.purpose === 'chat' && !input.chat_id) throw new ApiError(400,'invalid_request','Enter the chat ID to restore.');
  const isEmail = input.identifier.includes('@');
  const identifier = isEmail ? emailSchema.parse(input.identifier) : normalizePhone(input.identifier);
  const identityHash = digest(config.otpSecret, `identity:${identifier}`), ipHash = digest(config.otpSecret, `ip:${ip}`);
  const id = randomUUID(), code = generateOtp(), now = new Date(), expires = new Date(now.getTime() + OTP_TTL_MS);
  const challenge = await transaction(async tx => {
    const recent = new Date(now.getTime() - 60 * 60 * 1000);
    const [identityCount, ipCount, last] = await Promise.all([
      tx.otpChallenge.count({where:{identity_hash:identityHash,created_at:{gte:recent}}}),
      tx.otpChallenge.count({where:{ip_hash:ipHash,created_at:{gte:recent}}}),
      tx.otpChallenge.findFirst({where:{identity_hash:identityHash},orderBy:{created_at:'desc'}})
    ]);
    if (identityCount >= 5 || ipCount >= 20 || (last && now.getTime() - last.created_at.getTime() < 60000)) throw new ApiError(429,'rate_limited','Please wait before requesting another code.');
    const customer = await tx.customer.findUnique({where:isEmail ? {email:identifier} : {phone:identifier}});
    let email = customer?.email || null;
    let profile: Record<string,string> = {};
    if (!customer && input.purpose === 'login') {
      email = isEmail ? identifier : (input.email || null);
      profile = {name:input.name || '',phone:isEmail ? (input.phone || '') : identifier};
      // Never attach a new verified email to another customer's phone/account.
      if (profile.phone && await tx.customer.findUnique({where:{phone:profile.phone}})) email = null;
      if (!isEmail && email && await tx.customer.findUnique({where:{email}})) email = null;
    }
    if (input.purpose === 'chat') {
      const owned = customer && await tx.chat.findFirst({where:{id:input.chat_id,customer_id:customer.id}});
      if (!owned) email = null;
    }
    // Email and phone aliases of the same account share invalidation and limits.
    if (email) {
      const canonicalRecent = await tx.otpChallenge.count({where:{email,created_at:{gte:recent}}});
      const canonicalLast = await tx.otpChallenge.findFirst({where:{email},orderBy:{created_at:'desc'}});
      if (canonicalRecent >= 5 || (canonicalLast && now.getTime()-canonicalLast.created_at.getTime()<60000)) throw new ApiError(429,'rate_limited','Please wait before requesting another code.');
    }
    await tx.otpChallenge.updateMany({where:{OR:[{identity_hash:identityHash},...(email ? [{email}] : [])],consumed_at:null},data:{consumed_at:now}});
    return tx.otpChallenge.create({data:{id,identity_hash:identityHash,ip_hash:ipHash,code_hash:digest(config.otpSecret,`${id}:${code}`),email,customer_id:customer?.id || null,profile:jsonData(profile),purpose:input.purpose,chat_id:input.chat_id || null,expires_at:expires}});
  });
  if (challenge.email) {
    try { await sendOtpEmail(challenge.email,code,id,config); }
    catch (error) {
      await transaction(tx => tx.otpChallenge.update({where:{id},data:{consumed_at:new Date()}}));
      // Never show a successful send after the provider rejected it.
      throw error;
    }
  }
  return {challenge_id:id,expires_at:expires.toISOString(),message:'If these details can be verified, a six-digit code has been sent to the associated email. It expires in 10 minutes.'};
}
export async function verifyAuth(body: unknown, config: Config) {
  const input = z.object({challenge_id:z.string().uuid(),code:z.string().regex(/^\d{6}$/)}).strict().parse(body);
  const rawToken = token();
  const result = await transaction(async tx => {
    const challenge = await tx.otpChallenge.findUnique({where:{id:input.challenge_id}});
    const now = new Date();
    if (!challenge || !challenge.email || !validOtp(challenge,input.code,config.otpSecret,challenge.id,now)) {
      if (challenge && !challenge.consumed_at && challenge.attempts < MAX_OTP_ATTEMPTS) await tx.otpChallenge.update({where:{id:challenge.id},data:{attempts:{increment:1}}});
      return null; // Commit failed-attempt increment instead of rolling it back with an exception.
    }
    await tx.otpChallenge.update({where:{id:challenge.id},data:{consumed_at:now}});
    let customer = challenge.customer_id ? await tx.customer.findUnique({where:{id:challenge.customer_id}}) : null;
    if (!customer) {
      const profile = json<{name?:string;phone?:string}>(challenge.profile);
      const conflict = await tx.customer.findFirst({where:{OR:[{email:challenge.email},...(profile.phone ? [{phone:profile.phone}] : [])]}});
      if (conflict) return null;
      customer = await tx.customer.create({data:{id:randomUUID(),name:profile.name || 'Customer',email:challenge.email,phone:profile.phone || null,email_verified_at:now}});
    } else {
      if (customer.email !== challenge.email) return null;
      customer = await tx.customer.update({where:{id:customer.id},data:{email_verified_at:now}});
    }
    let chat;
    if (challenge.purpose === 'chat') {
      chat = await tx.chat.findFirst({where:{id:challenge.chat_id!,customer_id:customer.id}});
      if (!chat) return null;
    } else chat = await tx.chat.create({data:{customer_id:customer.id}});
    const session = await tx.authSession.create({data:{token_hash:hash(rawToken),customer_id:customer.id,chat_id:chat.id,expires_at:new Date(now.getTime()+AUTH_TTL_MS)}});
    return session;
  });
  if (!result) throw new ApiError(400,'invalid_otp','The code is invalid, expired, or already used. Request a new code if needed.');
  return {rawToken,session:result};
}
export async function authenticate(cookie: string | undefined): Promise<AuthSession> {
  const raw = cookie?.split(';').map(v => v.trim()).find(v => v.startsWith('veyrix_session='))?.slice('veyrix_session='.length);
  if (!raw || !/^[a-f0-9]{64}$/.test(raw)) throw new ApiError(401,'verification_required','Verify your email to continue.');
  const session = await db.authSession.findUnique({where:{token_hash:hash(raw)}});
  if (!session || session.expires_at.getTime() <= Date.now()) throw new ApiError(401,'verification_required','Your verification has expired. Verify your email again to continue.');
  return session;
}
export async function account(session: AuthSession) {
  const [customer,addresses,chat] = await Promise.all([db.customer.findUnique({where:{id:session.customer_id},select:{id:true,name:true,email:true,phone:true}}),db.address.findMany({where:{customer_id:session.customer_id},orderBy:{created_at:'desc'}}),db.chat.findFirst({where:{id:session.chat_id,customer_id:session.customer_id}})]);
  if (!customer || !chat) throw new ApiError(401,'verification_required','Verify your email to continue.');
  return {authenticated:true,customer,profile_required:!customer.phone || customer.name === 'Customer',addresses:addresses.map(a=>({id:a.id,...json<object>(a.details)})),chat_id:chat.id,messages:chat.messages,pending:chat.pending,ended:chat.status === 'ended'};
}
