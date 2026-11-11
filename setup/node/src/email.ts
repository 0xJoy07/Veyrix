import { ApiError } from './security.js';
export function otpEmail(code: string) {
  if (!/^\d{6}$/.test(code)) throw new Error('Invalid OTP template input.');
  return {
    subject: 'Your Veyrix verification code',
    text: `VEYRiX\nYour verification code is ${code}.\nThis code expires in 10 minutes and can only be used once. Enter it in the Veyrix verification form. Never share this code.\nIf you didn't request this email, you can safely ignore it.\nGood finds. Great conversations. — Veyrix`,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#f5f3ed;color:#252923;font-family:Arial,Helvetica,sans-serif"><div style="display:none;max-height:0;overflow:hidden">Your one-time Veyrix code. Valid for 10 minutes.</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ed"><tr><td align="center" style="padding:40px 16px"><table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#fffefa;border:1px solid #e5e3da;border-radius:20px"><tr><td style="padding:36px 36px 28px;border-bottom:1px solid #e5e3da"><span style="font-size:28px;font-weight:700;letter-spacing:-1.5px">veyrix<span style="color:#78816d">.</span></span><p style="margin:10px 0 0;font-size:10px;letter-spacing:2px;color:#74796c">SHOPPING, SIMPLIFIED</p></td></tr><tr><td style="padding:36px"><p style="font-size:11px;letter-spacing:2px;color:#78816d;font-weight:700">A LITTLE CHECK. THEN YOU’RE IN.</p><h1 style="font-family:Georgia,serif;font-size:34px;font-weight:400;line-height:1.2;margin:20px 0">Your next good find<br><em style="color:#78816d">is waiting.</em></h1><p style="font-size:15px;line-height:1.8;color:#666b60">Enter this code in your Veyrix verification form to securely continue your shopping conversation.</p><div style="background:#eef0e8;border:1px solid #dce1d2;border-radius:12px;text-align:center;padding:24px 10px;margin:28px 0"><span style="font-family:monospace;font-size:38px;font-weight:bold;letter-spacing:10px;color:#34452d">${code}</span></div><p style="font-size:13px;line-height:1.7;color:#666b60;text-align:center">Valid for <strong>10 minutes</strong> · One-time use only</p><p style="font-size:12px;line-height:1.8;color:#7a7d73;margin-top:28px">Keep this code private. Veyrix will never ask you to share it in a chat or a phone call. If you didn’t request this email, you can safely ignore it.</p></td></tr><tr><td style="padding:24px 36px;border-top:1px solid #e5e3da;font-size:11px;color:#85887d">Good finds. Great conversations.<br><span style="display:inline-block;margin-top:8px">Veyrix · Conversational commerce</span></td></tr></table></td></tr></table></body></html>`
  };
}
export function validSender(value: string) {
  return /^(?:[^<>\r\n]+\s<)?[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+>?$/.test(value.trim()) && (!value.includes('<') || value.endsWith('>'));
}
export async function sendOtpEmail(to: string, code: string, challengeId: string, config: {resendApiKey:string;resendFrom:string}, fetcher = fetch) {
  if (!validSender(config.resendFrom)) throw new ApiError(503,'email_not_configured','The email sender is not configured correctly. Set RESEND_FROM to a verified sender email address.');
  let response: Response;
  try {
    response = await fetcher('https://api.resend.com/emails', {method:'POST',headers:{Authorization:`Bearer ${config.resendApiKey}`,'Content-Type':'application/json','Idempotency-Key':`veyrix-otp/${challengeId}`},body:JSON.stringify({from:config.resendFrom,to:[to],...otpEmail(code)}),signal:AbortSignal.timeout(15000)});
  } catch {
    console.error(`[node] ${new Date().toISOString()} email failed: Resend connection/timeout`);
    throw new ApiError(503,'email_unavailable','Email delivery is temporarily unavailable. Please try again shortly.');
  }
  const data = await response.json().catch(() => ({})) as {name?:string;message?:string;id?:string};
  if (!response.ok) {
    const message = String(data.message || '').toLowerCase();
    const reason = message.includes('testing emails') ? 'Resend test sender can only email the account owner; verify a domain to send to customers.'
      : message.includes('domain') ? 'Sender domain is not verified or allowed by this API key.'
      : response.status === 401 ? 'Resend API key is invalid or lacks sending permission.'
      : response.status === 429 ? 'Resend rate or sending quota limit reached.'
      : 'Resend rejected the email. Check sender settings and the Resend dashboard.';
    console.error(`[node] ${new Date().toISOString()} email rejected status=${response.status}: ${reason}`);
    throw new ApiError(503,'email_unavailable',reason);
  }
  console.log(`[node] ${new Date().toISOString()} email accepted by Resend${data.id && /^[a-zA-Z0-9-]+$/.test(data.id) ? ' id='+data.id : ''}`);
}
