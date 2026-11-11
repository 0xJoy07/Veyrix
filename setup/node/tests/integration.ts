/** Opt-in real PostgreSQL check. Refuses any schema except veyrix_test_<hex>. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';

const url=process.env.VEYRIX_TEST_DATABASE_URL;
if(!url) throw new Error('Set VEYRIX_TEST_DATABASE_URL to an isolated prepared test schema.');
const schema=new URL(url).searchParams.get('schema');
if(!schema || !/^veyrix_test_[a-f0-9]{8,32}$/.test(schema)) throw new Error('Integration tests require an isolated veyrix_test_<hex> schema.');
process.env.CATALOG_SOURCE='public';
process.env.DATABASE_URL=url;process.env.DIRECT_URL=url;
const {db}=await import('../src/store.js');
const {createApp}=await import('../src/app.js');
const {loadConfig}=await import('../src/config.js');
const config=loadConfig({...process.env,RESEND_API_KEY:'test-only-no-email-sent',RESEND_FROM:'Veyrix <verification@example.invalid>',OTP_SECRET:'o'.repeat(40),INTERNAL_API_KEY:'i'.repeat(40),SHOPPING_API_KEY:'s'.repeat(40),PUBLIC_ORIGIN:'http://127.0.0.1:5174',COOKIE_SECURE:'false'});
const nativeFetch=globalThis.fetch;
const emails:Array<{to:string[];text:string}>=[];
globalThis.fetch=async(input,init)=>{
  if(String(input)==='https://api.resend.com/emails') {emails.push(JSON.parse(String(init?.body)));return Response.json({id:randomUUID()});}
  return nativeFetch(input,init);
};
const server=createApp(config).listen(0,'127.0.0.1');await once(server,'listening');
const address=server.address();assert.ok(address && typeof address!=='string');
const base=`http://127.0.0.1:${address.port}`;
let cookie='';
async function call(path:string,body?:unknown,expected=200,headers:Record<string,string>={}) {
  const response=await nativeFetch(base+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Cookie:cookie,...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const result=await response.json() as any;
  assert.equal(response.status,expected,`${path}: ${result.error?.code || 'unexpected status'}`);
  const received=response.headers.get('set-cookie');if(received) cookie=received.split(';')[0];
  return result;
}
const nonce=randomUUID().replaceAll('-','').slice(0,10),email=`customer-${nonce}@example.invalid`,otherEmail=`other-${nonce}@example.invalid`;
async function verify(identifier:string,extra:Record<string,unknown>={}) {
  const started=await call('/api/auth/start',{identifier,...extra});
  const sent=emails.at(-1);assert.ok(sent);const code=sent.text.match(/\b\d{6}\b/)?.[0];assert.ok(code);
  const result=await call('/api/auth/verify',{challenge_id:started.challenge_id,code});
  return {...result,challenge:started.challenge_id,code};
}
try {
  await db.$connect();
  await db.product.create({data:{id:'1',name:'Old copied catalog item',description:'Legacy',category:'Shoes',price_minor:999,stock:77}});
  await db.$executeRawUnsafe(`INSERT INTO "${schema}".source_products VALUES (1,'Integration Shoe','Live catalog','Shoes','Test',120.00,10,true),(2,'Inactive product','Hidden','Shoes','Test',50.00,10,false)`);
  await db.$executeRawUnsafe(`INSERT INTO "${schema}".source_reviews VALUES (1,1,5,'Live review')`);
  assert.equal((await call('/api/account')).authenticated,false);
  await call('/api/chat',{message:'Hello'},401);
  const owner=await verify(email,{name:'Integration Customer',phone:'9876543210'});
  assert.equal(owner.customer.email,email);assert.equal(owner.authenticated,true);
  await call('/api/auth/verify',{challenge_id:owner.challenge,code:owner.code},400);
  assert.equal((await call('/api/account')).customer.id,owner.customer.id);
  const saved=await call('/api/addresses',{recipient_name:'Integration Customer',phone:'9876543210',line1:'42 Test Road',landmark:'Near test park',city:'Kolkata',state:'West Bengal',pincode:'700001'});
  assert.ok(saved.address.id);
  const turn=randomUUID();
  await db.chat.update({where:{id:owner.chat_id},data:{lease_token:turn,lease_until:new Date(Date.now()+60000)}});
  const search=await call('/internal/tools',{chat_id:owner.chat_id,customer_id:owner.customer.id,turn_id:turn,name:'product_search',args:{query:''}},200,{Authorization:`Bearer ${config.internalKey}`});
  assert.deepEqual(search.map((p:any)=>p.id),['public:1']); assert.equal(search[0].price_minor,12000);
  const reviews=await call('/internal/tools',{chat_id:owner.chat_id,customer_id:owner.customer.id,turn_id:turn,name:'product_reviews',args:{product_id:'public:1'}},200,{Authorization:`Bearer ${config.internalKey}`});
  assert.equal(reviews.reviews[0].text,'Live review');
  await call('/internal/tools',{chat_id:owner.chat_id,customer_id:owner.customer.id,turn_id:turn,name:'cart_add',args:{product_id:'public:1',quantity:2}},200,{Authorization:`Bearer ${config.internalKey}`});
  await call('/internal/tools',{chat_id:owner.chat_id,customer_id:owner.customer.id,turn_id:randomUUID(),name:'cart_clear',args:{}},409,{Authorization:`Bearer ${config.internalKey}`});
  await db.chat.update({where:{id:owner.chat_id},data:{lease_token:null,lease_until:null}});
  let prepared=await call('/api/checkout/prepare',{address_id:saved.address.id});
  await db.$executeRawUnsafe(`UPDATE "${schema}".source_products SET price=130.00 WHERE id=1`);
  await call('/api/chat/confirm',{confirmation_id:prepared.pending.token},409);
  prepared=await call('/api/checkout/prepare',{address_id:saved.address.id});
  assert.equal(prepared.pending.summary.items[0].price_minor,13000);
  const [confirmed]=await Promise.all([call('/api/chat/confirm',{confirmation_id:prepared.pending.token}),call('/api/chat/confirm',{confirmation_id:prepared.pending.token})]);
  await call('/api/chat/confirm',{confirmation_id:prepared.pending.token});
  assert.equal(await db.order.count({where:{customer_id:owner.customer.id}}),1);
  assert.equal((await db.liveProduct.findUnique({where:{id:'public:1'}}))?.stock,8);
  const orderId=confirmed.result.order_id;
  const lookup=await call('/api/orders/lookup',{order_id:orderId});assert.equal(lookup.order.request_id,undefined);
  const cancel=await call('/api/orders/cancel/prepare',{order_id:orderId});
  await db.order.update({where:{id:orderId},data:{status:'dispatched'}});
  await call('/api/chat/confirm',{confirmation_id:cancel.pending.token},409);
  assert.equal((await db.liveProduct.findUnique({where:{id:'public:1'}}))?.stock,8);
  assert.equal((await db.order.findUnique({where:{id:orderId}}))?.status,'dispatched');
  // Test-only reset of the isolated fixture lets us also exercise successful cancellation.
  await db.order.update({where:{id:orderId},data:{status:'preparing'}});
  await Promise.all([call('/api/chat/confirm',{confirmation_id:cancel.pending.token}),call('/api/chat/confirm',{confirmation_id:cancel.pending.token})]);
  await call('/api/chat/confirm',{confirmation_id:cancel.pending.token});
  assert.equal((await db.liveProduct.findUnique({where:{id:'public:1'}}))?.stock,10);
  assert.equal((await db.order.findUnique({where:{id:orderId}}))?.status,'cancelled');
  assert.equal((await db.product.findUnique({where:{id:'1'}}))?.stock,77);
  const ended=await call('/api/chat/end',{});assert.equal(ended.chat_id,owner.chat_id);assert.match(ended.answer,/Thank you/);
  const originalMessages=(await db.chat.findUnique({where:{id:owner.chat_id}}))?.messages;
  await call('/api/chat',{message:'Continue'},409);
  await call('/api/auth/logout',{});assert.equal((await call('/api/account')).authenticated,false);
  const other=await verify(otherEmail,{name:'Other Customer',phone:'9876543211'});
  await call('/api/orders/lookup',{order_id:orderId},404);
  await call('/api/checkout/prepare',{address_id:saved.address.id},404);
  await db.otpChallenge.updateMany({where:{email:otherEmail},data:{created_at:new Date(Date.now()-61000)}});
  const sentCount=emails.length;
  const denied=await call('/api/auth/start',{identifier:otherEmail,purpose:'chat',chat_id:owner.chat_id});
  assert.equal(emails.length,sentCount);
  await call('/api/auth/verify',{challenge_id:denied.challenge_id,code:'123456'},400);
  await call('/api/chat/restore',{chat_id:owner.chat_id},403);
  assert.equal((await call('/api/account')).customer.id,other.customer.id);
  await db.otpChallenge.updateMany({where:{email},data:{created_at:new Date(Date.now()-61000)}});
  const restored=await verify(email,{purpose:'chat',chat_id:owner.chat_id});
  assert.equal(restored.chat_id,owner.chat_id);assert.equal(restored.ended,true);assert.deepEqual(restored.messages,originalMessages);
  // Deadline is enforced by the server, not the frontend countdown.
  await db.otpChallenge.updateMany({where:{email},data:{created_at:new Date(Date.now()-61000)}});
  const expired=await call('/api/auth/start',{identifier:email});
  const code=emails.at(-1)!.text.match(/\b\d{6}\b/)![0];
  await db.otpChallenge.update({where:{id:expired.challenge_id},data:{expires_at:new Date(Date.now()-1)}});
  await call('/api/auth/verify',{challenge_id:expired.challenge_id,code},400);
  console.log('Real PostgreSQL integration passed: verified signup, private account/address/cart/order, idempotent checkout/cancellation, OTP reuse/expiry, owner-only chat restoration. No emails sent.');
} finally {
  globalThis.fetch=nativeFetch;
  server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));
  await db.$disconnect();
}
