import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db, type Tx } from '../src/store.js';
import { startAuth, verifyAuth } from '../src/auth.js';
import { chat, confirm, prepareCancel, prepareCheckout, tool } from '../src/commerce.js';
import { ApiError, digest, OTP_TTL_MS } from '../src/security.js';
import type { Config } from '../src/config.js';
import type { AuthSession } from '@prisma/client';

type Row=Record<string,any>;
type State=Record<string,Row[]>;
function matches(row:Row,where:Row={}):boolean {
  return Object.entries(where).every(([k,v])=>{
    if(k==='OR') return v.some((part:Row)=>matches(row,part));
    if(v===null || typeof v!=='object' || v instanceof Date) return row[k]===v;
    return Object.entries(v).every(([op,value]:[string,any])=>op==='gte'?row[k]>=value:op==='gt'?row[k]>value:op==='in'?value.includes(row[k]):op==='not'?row[k]!==value:op==='lte'?row[k]<=value:false);
  });
}
function model(rows:Row[]) {
  const select=(args:Row={})=>rows.filter(r=>matches(r,args.where));
  const update=(row:Row,data:Row)=>{for(const [k,v] of Object.entries(data)) row[k]=v && typeof v==='object' && 'increment' in v?row[k]+v.increment:v && typeof v==='object' && 'decrement' in v?row[k]-v.decrement:structuredClone(v);return structuredClone(row);};
  return {
    async findFirst(args:Row={}) {let list=select(args);if(args.orderBy) {const key=Object.keys(args.orderBy)[0];list=list.sort((a,b)=>a[key]>b[key]?-1:1);}return structuredClone(list[0] || null);},
    async findUnique(args:Row) {return structuredClone(select(args)[0] || null);},
    async findMany(args:Row={}) {return structuredClone(select(args));},
    async count(args:Row={}) {return select(args).length;},
    async create({data}:Row) {const row={id:randomUUID(),attempts:0,consumed_at:null,cart:{},pending:{},messages:[],status:'active',lease_until:null,lease_token:null,created_at:new Date(),...structuredClone(data)};rows.push(row);return structuredClone(row);},
    async createMany({data}:Row) {rows.push(...structuredClone(data));return {count:data.length};},
    async update({where,data}:Row) {const row=select({where})[0];assert.ok(row,'updated row exists');return update(row,data);},
    async updateMany({where,data}:Row) {const targets=select({where});targets.forEach(r=>update(r,data));return {count:targets.length};}
  };
}
function fixture(t:any) {
  const oldSource=process.env.CATALOG_SOURCE; process.env.CATALOG_SOURCE='legacy'; t.after(()=>{if(oldSource===undefined) delete process.env.CATALOG_SOURCE;else process.env.CATALOG_SOURCE=oldSource;});
  let state:State={customer:[],chat:[],address:[],product:[],review:[],order:[],orderItem:[],orderEvent:[],authSession:[],otpChallenge:[]};
  const original=db.$transaction;
  (db as any).$transaction=async(fn:any)=>{
    const working=structuredClone(state), tx=Object.fromEntries(Object.entries(working).map(([k,v])=>[k,model(v)]));
    const result=await fn(tx as unknown as Tx); state=working;return result;
  };
  t.after(()=>{(db as any).$transaction=original;});
  return {get state(){return state;}};
}
const config:Config={resendApiKey:'test-secret',resendFrom:'Veyrix <verify@example.test>',otpSecret:'x'.repeat(40),internalKey:'i'.repeat(40),pythonKey:'p'.repeat(40),pythonUrl:'http://127.0.0.1:8000',port:8001,host:'127.0.0.1',publicOrigin:'http://127.0.0.1:5174',cookieSecure:false,deliveryMinor:0};
const delivery={recipient_name:'Customer',phone:'+919876543210',line1:'42 Test Road',line2:'',landmark:'Near park',city:'Kolkata',state:'West Bengal',pincode:'700001'};
function seed(f:ReturnType<typeof fixture>) {
  const customerId=randomUUID(),chatId=randomUUID(),addressId=randomUUID();
  f.state.customer.push({id:customerId,name:'Test Customer',email:'test@example.test',phone:'+919876543210',email_verified_at:new Date()});
  f.state.chat.push({id:chatId,customer_id:customerId,cart:{shoe:2},pending:{},messages:[],status:'active',lease_until:null,lease_token:null});
  f.state.product.push({id:'shoe',name:'Shoe',price_minor:10000,stock:5});
  f.state.address.push({id:addressId,customer_id:customerId,details:delivery});
  const session={token_hash:'token',customer_id:customerId,chat_id:chatId,expires_at:new Date(Date.now()+3600000),verified_at:new Date()} as AuthSession;
  f.state.authSession.push(session);return {session,addressId};
}
test('checkout commits once, verifies ownership, and cancellation restores stock once',async t=>{
  const f=fixture(t),{session,addressId}=seed(f);
  await assert.rejects(prepareCheckout({...session,customer_id:'other'},{address_id:addressId},config),(e:unknown)=>e instanceof ApiError && e.status===404);
  const prepared=await prepareCheckout(session,{address_id:addressId},config);
  // PostgreSQL JSONB reorders object keys; order identity must compare values.
  f.state.chat[0].pending.summary.items=f.state.chat[0].pending.summary.items.map((item:Row)=>({price_minor:item.price_minor,quantity:item.quantity,name:item.name,id:item.id}));
  const placed=await confirm(session,{confirmation_id:prepared.pending.token},config);
  await confirm(session,{confirmation_id:prepared.pending.token},config);
  assert.equal(f.state.order.length,1);assert.equal(f.state.product[0].stock,3);
  const cancelled=await prepareCancel(session,{order_id:placed.result.order_id});
  await confirm(session,{confirmation_id:cancelled.pending.token},config);
  await confirm(session,{confirmation_id:cancelled.pending.token},config);
  assert.equal(f.state.product[0].stock,5);assert.equal(f.state.order[0].status,'cancelled');
  assert.equal(f.state.orderEvent.filter(r=>r.event==='cancelled').length,1);
});
test('dispatch between cancellation preview and confirmation prevents cancellation and stock mutation',async t=>{
  const f=fixture(t),{session,addressId}=seed(f);
  const prepared=await prepareCheckout(session,{address_id:addressId},config);
  const placed=await confirm(session,{confirmation_id:prepared.pending.token},config);
  const cancelled=await prepareCancel(session,{order_id:placed.result.order_id});
  f.state.order[0].status='dispatched';
  await assert.rejects(confirm(session,{confirmation_id:cancelled.pending.token},config),/no longer eligible/);
  assert.equal(f.state.product[0].stock,3);assert.equal(f.state.order[0].status,'dispatched');
});
test('changed stock/price blocks order and a foreign delivery address cannot be selected',async t=>{
  const f=fixture(t),{session,addressId}=seed(f);
  f.state.address.push({id:'foreign',customer_id:'other',details:delivery});
  await assert.rejects(prepareCheckout(session,{address_id:'foreign'},config),/saved addresses/);
  const prepared=await prepareCheckout(session,{address_id:addressId},config);
  f.state.product[0].price_minor=20000;
  await assert.rejects(confirm(session,{confirmation_id:prepared.pending.token},config),/changed/);
  assert.equal(f.state.order.length,0);assert.equal(f.state.product[0].stock,5);
});
test('failed OTP attempts persist, exact expiry fails, consumed OTP cannot create another session',async t=>{
  const f=fixture(t),{session}=seed(f),id=randomUUID(),code='012345';
  f.state.otpChallenge.push({id,code_hash:digest(config.otpSecret,`${id}:${code}`),expires_at:new Date(Date.now()+OTP_TTL_MS),consumed_at:null,attempts:0,email:'test@example.test',customer_id:session.customer_id,profile:{},purpose:'login'});
  await assert.rejects(verifyAuth({challenge_id:id,code:'999999'},config),/invalid/);
  assert.equal(f.state.otpChallenge[0].attempts,1);
  await verifyAuth({challenge_id:id,code},config);
  assert.ok(f.state.otpChallenge[0].consumed_at);
  const count=f.state.authSession.length;
  await assert.rejects(verifyAuth({challenge_id:id,code},config),/invalid/);
  assert.equal(f.state.authSession.length,count);
});
test('resend invalidates old code, unknown phone remains generic, and account conflict never merges identities',async t=>{
  const f=fixture(t); seed(f);
  const sent:any[]=[]; const fetchMock=mock.method(globalThis,'fetch',async(_url:any,options:any)=>{sent.push(JSON.parse(options.body));return new Response('{}');});
  t.after(()=>fetchMock.mock.restore());
  const first=await startAuth({identifier:'test@example.test'},'127.0.0.1',config);
  f.state.otpChallenge[0].created_at=new Date(Date.now()-61000);
  const next=await startAuth({identifier:'test@example.test'},'127.0.0.1',config);
  assert.notEqual(first.challenge_id,next.challenge_id);assert.ok(f.state.otpChallenge[0].consumed_at);assert.equal(sent.length,2);
  const unknown=await startAuth({identifier:'9999999999'},'127.0.0.2',config);
  assert.equal(unknown.message,first.message);assert.equal(sent.length,2);
  await startAuth({identifier:'new@example.test',name:'Attacker',phone:'9876543210'},'127.0.0.3',config);
  assert.equal(sent.length,2);assert.equal(f.state.customer.length,1);
});
test('internal tools require current leased turn and unexpired verified account',async t=>{
  const f=fixture(t),{session}=seed(f),turn=randomUUID();
  f.state.chat[0].lease_token=turn;f.state.chat[0].lease_until=new Date(Date.now()+10000);
  const input={chat_id:session.chat_id,customer_id:session.customer_id,turn_id:turn,name:'cart_view',args:{}};
  assert.ok(await tool(input));
  await assert.rejects(tool({...input,turn_id:randomUUID()}),/expired/);
  f.state.authSession[0].expires_at=new Date(Date.now()-1);
  await assert.rejects(tool(input),/verification has expired/);
});

test('failed Resend delivery invalidates the OTP and reports failure instead of a successful send',async t=>{
  const f=fixture(t); seed(f);
  const fetchMock=mock.method(globalThis,'fetch',async()=>Response.json({message:'Sender domain is not verified'},{status:403}));
  t.after(()=>fetchMock.mock.restore());
  await assert.rejects(startAuth({identifier:'test@example.test'},'127.0.0.1',config),(e:unknown)=>e instanceof ApiError && e.code==='email_unavailable');
  assert.ok(f.state.otpChallenge[0].consumed_at);
});

test('chat progress is followed by persisted answer; turn identity never comes from body',async t=>{
  const f=fixture(t),{session}=seed(f);
  const originalRelease=db.chat.updateMany;
  (db.chat as any).updateMany=async()=>{assert.fail('A committed reply already released its lease; do not make an extra database call.');};
  const stages:string[]=[];
  const upstream=mock.method(globalThis,'fetch',async(_url,options)=>{
    const sent=JSON.parse(String(options?.body));
    assert.equal(sent.customer_id,session.customer_id);
    assert.equal(sent.chat_id,session.chat_id);
    assert.equal(sent.turn_id,f.state.chat[0].lease_token);
    assert.equal(options?.redirect,'error');
    return Response.json({answer:'Current cart result.'});
  });
  t.after(()=>{(db.chat as any).updateMany=originalRelease;upstream.mock.restore();});
  const result=await chat(session,{message:'Show my cart'},config,stage=>stages.push(stage));
  assert.deepEqual(stages,['working','saving']);
  assert.equal(f.state.chat[0].messages.at(-1).content,result.answer);
  assert.equal(f.state.chat[0].lease_token,null);
  await assert.rejects(chat(session,{message:'Hi',customer_id:'other'},config));
  assert.equal(upstream.mock.callCount(),1);
});

test('chat rejects incomplete/unverified profiles before model access and releases failed turns',async t=>{
  const f=fixture(t),{session}=seed(f);
  const originalRelease=db.chat.updateMany;let releases=0;
  (db.chat as any).updateMany=async()=>{releases++;return {count:1};};
  const upstream=mock.method(globalThis,'fetch',async()=>{throw new Error('private provider error');});
  t.after(()=>{(db.chat as any).updateMany=originalRelease;upstream.mock.restore();});
  f.state.customer[0].phone=null;
  await assert.rejects(chat(session,{message:'Hi'},config),(e:unknown)=>e instanceof ApiError && e.code==='profile_required');
  f.state.customer[0].phone='+919876543210';
  f.state.customer[0].email_verified_at=null;
  await assert.rejects(chat(session,{message:'Hi'},config),(e:unknown)=>e instanceof ApiError && e.code==='verification_required');
  assert.equal(upstream.mock.callCount(),0);
  f.state.customer[0].email_verified_at=new Date();
  await assert.rejects(chat(session,{message:'Hi'},config),(e:unknown)=>e instanceof ApiError && e.code==='request_outcome_unknown' && !e.message.includes('private'));
  assert.equal(releases,1);
});

test('a failure after a cart mutation reports an unknown outcome instead of inviting replay',async t=>{
  const f=fixture(t),{session}=seed(f);
  const originalRelease=db.chat.updateMany;
  (db.chat as any).updateMany=async()=>{throw new Error('private database outage');};
  const upstream=mock.method(globalThis,'fetch',async()=>{
    // Represent a tool committing successfully before generation fails.
    f.state.chat[0].cart.shoe=3;
    throw new Error('private model failure');
  });
  t.after(()=>{(db.chat as any).updateMany=originalRelease;upstream.mock.restore();});
  await assert.rejects(chat(session,{message:'Add one more shoe'},config),(e:unknown)=>
    e instanceof ApiError && e.code==='request_outcome_unknown' && /check your cart/.test(e.message) && !/private/.test(e.message));
  assert.equal(f.state.chat[0].cart.shoe,3);
  assert.equal(f.state.chat[0].messages.length,0);
  assert.equal(upstream.mock.callCount(),1);
});
