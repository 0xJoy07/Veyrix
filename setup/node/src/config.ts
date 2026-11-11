import 'dotenv/config';
export function loadConfig(env = process.env) {
  for (const key of ['DATABASE_URL','DIRECT_URL','OTP_SECRET','INTERNAL_API_KEY','SHOPPING_API_KEY']) {
    if (!env[key]?.trim()) throw new Error(`Set ${key} in setup/node/.env.`);
  }
  for (const key of ['OTP_SECRET','INTERNAL_API_KEY','SHOPPING_API_KEY']) if (env[key]!.length < 32 || /\s/.test(env[key]!)) throw new Error(`${key} must contain at least 32 characters without whitespace.`);
  const db = new URL(env.DATABASE_URL!);
  if (!['postgres:', 'postgresql:'].includes(db.protocol) || ['localhost','127.0.0.1','[::1]'].includes(db.hostname)) throw new Error('DATABASE_URL must connect to remote Supabase PostgreSQL; local persistence is disabled.');
  const deliveryMinor = Number(env.DELIVERY_MINOR || 0);
  if (!Number.isSafeInteger(deliveryMinor) || deliveryMinor < 0) throw new Error('DELIVERY_MINOR must be a nonnegative integer.');
  const publicOrigin = new URL(env.PUBLIC_ORIGIN || 'http://127.0.0.1:5174').origin;
  if (publicOrigin.startsWith('https:') && env.COOKIE_SECURE !== 'true') throw new Error('Use COOKIE_SECURE=true with HTTPS.');
  return {resendApiKey:env.RESEND_API_KEY || '',resendFrom:env.RESEND_FROM || '',otpSecret:env.OTP_SECRET!,internalKey:env.INTERNAL_API_KEY!,pythonKey:env.SHOPPING_API_KEY!,pythonUrl:env.PYTHON_API_URL || 'http://127.0.0.1:8000',port:Number(env.PORT || 8001),host:env.HOST || '127.0.0.1',publicOrigin,cookieSecure:env.COOKIE_SECURE === 'true',deliveryMinor};
}
export type Config = ReturnType<typeof loadConfig>;
