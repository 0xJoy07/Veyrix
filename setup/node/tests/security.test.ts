import test from 'node:test';
import assert from 'node:assert/strict';
import { addressSchema, canCancel, digest, generateOtp, normalizePhone, OTP_TTL_MS, validOtp } from '../src/security.js';
import { otpEmail, sendOtpEmail } from '../src/email.js';

test('OTP expires at exactly ten minutes and cannot be reused or exceed attempt limit',()=>{
  const start=new Date('2026-01-01T00:00:00Z'), id='challenge',secret='private';
  const record={code_hash:digest(secret,`${id}:012345`),expires_at:new Date(start.getTime()+OTP_TTL_MS),consumed_at:null,attempts:0};
  assert.equal(validOtp(record,'012345',secret,id,new Date(record.expires_at.getTime()-1)),true);
  assert.equal(validOtp(record,'012345',secret,id,record.expires_at),false);
  assert.equal(validOtp({...record,consumed_at:start},'012345',secret,id,start),false);
  assert.equal(validOtp({...record,attempts:5},'012345',secret,id,start),false);
  assert.equal(validOtp(record,'012345',secret,'different',start),false);
  for(let n=0;n<100;n++) assert.match(generateOtp(),/^\d{6}$/);
});
test('Indian delivery details require landmark, valid phone/PIN and Indian state',()=>{
  const address={recipient_name:'Test Customer',phone:'9876543210',line1:'42 Test Road',landmark:'Near the park',city:'Kolkata',state:'West Bengal',pincode:'700001'};
  assert.equal(addressSchema.parse(address).phone,'+919876543210');
  assert.equal(normalizePhone('+91 98765 43210'),'+919876543210');
  assert.throws(()=>addressSchema.parse({...address,landmark:''}));
  assert.throws(()=>addressSchema.parse({...address,pincode:'000001'}));
  assert.throws(()=>addressSchema.parse({...address,state:'California'}));
  assert.throws(()=>normalizePhone('+12025550123'));
});
test('only pre-dispatch orders can be cancelled',()=>{
  assert.equal(canCancel('confirmed'),true); assert.equal(canCancel('preparing'),true);
  for(const status of ['dispatched','shipped','delivered','cancelled','unknown']) assert.equal(canCancel(status),false);
});
test('polished OTP mail has accessible text and safe six-digit interpolation',async()=>{
  const mail=otpEmail('012345');
  assert.match(mail.html,/veyrix/); assert.match(mail.html,/012345/); assert.match(mail.text,/10 minutes/);
  assert.throws(()=>otpEmail('<script>'));
  let request: RequestInit | undefined;
  await sendOtpEmail('test@example.test','012345','challenge',{resendApiKey:'private',resendFrom:'Veyrix <verify@example.test>'},async(_url,options)=>{request=options;return new Response('{}',{status:200});});
  assert.equal((request?.headers as Record<string,string>)['Idempotency-Key'],'veyrix-otp/challenge');
  assert.match(request?.body as string,/"text"/);
});
