import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { readFileSync } from 'node:fs';
import { rootCertificates } from 'node:tls';
import 'dotenv/config';
import { ApiError } from './security.js';
// The unreachable placeholder lets dependency-injected unit tests import the
// client without credentials. Production config requires DATABASE_URL before use.
const connectionString = process.env.DATABASE_URL || 'postgresql://test:test@database.invalid/test';
function parseDatabaseUrl(value: string) {
  try { return new URL(value); }
  catch { throw new Error('DATABASE_URL is invalid. Check the server environment configuration.'); }
}
const databaseUrl = parseDatabaseUrl(connectionString);
const schema = databaseUrl.searchParams.get('schema') || 'shopping_agent';
const configuredCa = process.env.DATABASE_SSL_CA || databaseUrl.searchParams.get('sslrootcert');
const hostedSupabase = /\.(supabase\.co|pooler\.supabase\.com)$/.test(databaseUrl.hostname);
const ca = configuredCa ? readFileSync(configuredCa,'utf8') : hostedSupabase ? readFileSync(new URL('../certs/supabase-prod-ca-2021.crt',import.meta.url),'utf8') : undefined;
// pg URL SSL options override the explicit ssl object. Supply the trusted CA
// directly and always retain chain + hostname verification (never rejectUnauthorized:false).
for (const key of ['sslmode','sslrootcert','sslcert','sslkey','ssl']) databaseUrl.searchParams.delete(key);
const adapter = new PrismaPg({connectionString:databaseUrl.toString(),ssl:{rejectUnauthorized:true,...(ca ? {ca:[...rootCertificates,ca]} : {})},max:10,connectionTimeoutMillis:10000,idleTimeoutMillis:30000},{schema});
export const db = new PrismaClient({adapter,log:[]});
export type Tx = Prisma.TransactionClient;
export type Message = {role:'user'|'assistant';content:string};
export function json<T>(value: unknown): T { return value as T; }
export const jsonData = (value: unknown) => value as Prisma.InputJsonValue;
export async function transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await db.$transaction(fn, {isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:15000,maxWait:10000}); }
    catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2034' || attempt >= 3) throw error;
    }
  }
}
export async function ownedChat(tx: Tx, id: string, customerId: string) {
  const chat = await tx.chat.findFirst({where:{id,customer_id:customerId}});
  if (!chat) throw new ApiError(404,'not_found','The requested conversation is unavailable.');
  return chat;
}
