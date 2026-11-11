import test from 'node:test';
import assert from 'node:assert/strict';
import { sendOtpEmail, validSender } from '../src/email.js';
import { ApiError } from '../src/security.js';
test('sender must include an email; a display name cannot silently pass', async () => {
 assert.equal(validSender('Team Veyrix'),false);
 assert.equal(validSender('Team Veyrix <hello@example.com>'),true);
 await assert.rejects(sendOtpEmail('recipient@example.com','123456','test',{resendApiKey:'secret',resendFrom:'Team Veyrix'},async()=>{throw new Error('must not send');}), (e:unknown)=>e instanceof ApiError && e.code==='email_not_configured');
});
test('Resend rejection is actionable and never exposes its recipient or raw error',async()=>{
 await assert.rejects(sendOtpEmail('private@example.com','123456','test',{resendApiKey:'secret',resendFrom:'Veyrix <onboarding@resend.dev>'},async()=>Response.json({message:'You can only send testing emails to your own email address private@example.com'},{status:403})),(e:unknown)=>e instanceof ApiError && /test sender/.test(e.message) && !e.message.includes('private@example.com'));
});
