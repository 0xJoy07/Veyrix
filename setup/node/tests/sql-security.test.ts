import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db, type Tx } from '../src/store.js';
import { lookupOrder, tool } from '../src/commerce.js';
import { ApiError } from '../src/security.js';
import { databaseSchema } from '../src/database-config.js';

const payload = "x'; DROP TABLE products; --";

test('configured database schema accepts identifiers and rejects SQL syntax', () => {
  const url = new URL('postgresql://user:password@database.invalid/store');
  assert.equal(databaseSchema(url), 'shopping_agent');
  for (const schema of ['shopping_agent', 'veyrix_test_ab12', '_private', 'Catalog2']) {
    url.searchParams.set('schema', schema);
    assert.equal(databaseSchema(url), schema);
  }
  for (const schema of ['', 'public"; DROP TABLE customers; --', 'public,private', 'public\nSELECT 1', 'a'.repeat(64), '1public', 'public.schema']) {
    url.searchParams.set('schema', schema);
    assert.throws(() => databaseSchema(url));
  }
});

test('search payload remains a Prisma value and cannot select SQL identifiers', async t => {
  const previous = process.env.CATALOG_SOURCE;
  process.env.CATALOG_SOURCE = 'public';
  t.after(() => { if (previous === undefined) delete process.env.CATALOG_SOURCE; else process.env.CATALOG_SOURCE = previous; });
  const chatId = randomUUID(), turnId = randomUUID();
  let captured: any;
  const tx = {
    chat: { findFirst: async ({where}: any) => where.id === chatId && where.customer_id === 'alice'
      ? { id: chatId, status: 'active', lease_token: turnId, lease_until: new Date(Date.now() + 60000) } : null },
    authSession: { findFirst: async () => ({customer_id: 'alice'}) },
    liveProduct: { findMany: async (args: any) => { captured = args; return []; } },
  };
  const original = db.$transaction;
  (db as any).$transaction = async (fn: any) => fn(tx);
  t.after(() => { (db as any).$transaction = original; });
  const request = {chat_id: chatId, customer_id: 'alice', turn_id: turnId, name: 'product_search', args: {query: payload}};
  assert.deepEqual(await tool(request), []);
  assert.deepEqual(captured.where.OR, ['name', 'description', 'category'].map(key => ({[key]: {contains: payload, mode: 'insensitive'}})));
  assert.equal(captured.where.is_active, true);
  captured = undefined;
  await assert.rejects(tool({...request, customer_id: "alice' OR 1=1 --"}), (error: unknown) => error instanceof ApiError && error.status === 404);
  assert.equal(captured, undefined);
  await assert.rejects(tool({...request, name: 'products; DROP TABLE customers; --'}), (error: unknown) => error instanceof ApiError && error.code === 'unknown_tool');
  assert.equal(captured, undefined);
});

test('order lookup keeps both hostile ID and owner as literal Prisma filter values', async () => {
  const owned = {id: payload, customer_id: 'bob', request_id: 'private', status: 'confirmed'};
  let captured: any;
  let itemReads = 0;
  const tx = {
    order: {findFirst: async ({where}: any) => {
      captured = where;
      return where.id === owned.id && where.customer_id === owned.customer_id ? owned : null;
    }},
    orderItem: {findMany: async () => { itemReads += 1; return []; }},
  } as unknown as Tx;
  await assert.rejects(lookupOrder(tx, 'alice', payload), (error: unknown) => error instanceof ApiError && error.status === 404);
  assert.deepEqual(captured, {id: payload, customer_id: 'alice'});
  await assert.rejects(lookupOrder(tx, "bob' OR '1'='1", payload), (error: unknown) => error instanceof ApiError && error.status === 404);
  assert.equal(itemReads, 0);
  const result = await lookupOrder(tx, 'bob', payload);
  assert.equal(result.id, payload);
  assert.equal('customer_id' in result, false);
  assert.equal('request_id' in result, false);
});
