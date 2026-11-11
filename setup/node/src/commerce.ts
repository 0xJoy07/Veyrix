import { randomUUID } from 'node:crypto';
import type { AuthSession } from '@prisma/client';
import { z } from 'zod';
import { ApiError, addressSchema, canCancel, type DeliveryAddress } from './security.js';
import { db, transaction, ownedChat, json, jsonData, type Tx, type Message } from './store.js';
import type { Config } from './config.js';

type Cart = Record<string,number>;
type Item = {id:string;name:string;quantity:number;price_minor:number};
type Summary = {items:Item[];delivery:DeliveryAddress;address:string;currency:string;delivery_minor:number;total_minor:number;payment_method:string};
type Pending = {token?:string;kind?:string;expires?:number;summary?:Summary;order_id?:string};
const idSchema = z.string().min(1).max(100);
const liveCatalog = () => process.env.CATALOG_SOURCE !== 'legacy';
const isLiveId = (id: string) => /^public:[1-9]\d*$/.test(id);
const getProduct = (tx: Tx, id: string) => isLiveId(id) ? tx.liveProduct.findUnique({where:{id}}) : tx.product.findUnique({where:{id}});
async function restoreStock(tx: Tx, id: string, quantity: number) {
  if(isLiveId(id)) await tx.liveProduct.update({where:{id},data:{stock:{increment:quantity}}});
  else await tx.product.update({where:{id},data:{stock:{increment:quantity}}});
}
function reserveStock(tx: Tx, item: Item) {
  const where={id:item.id,stock:{gte:item.quantity},price_minor:item.price_minor,name:item.name};
  const data={stock:{decrement:item.quantity}};
  return isLiveId(item.id) ? tx.liveProduct.updateMany({where:{...where,is_active:true},data}) : tx.product.updateMany({where,data});
}
function requireCurrentCatalog(id: string) {
  if (liveCatalog() && !isLiveId(id)) throw new ApiError(409,'catalog_changed','This item belongs to the previous catalog. Remove it from your cart and choose a product from the live catalog.');
}
const now = () => new Date().toISOString();
export function assertNotBusy(chat: {lease_until:Date|null}) {
  if (chat.lease_until && chat.lease_until.getTime() > Date.now()) throw new ApiError(409,'request_in_progress','Wait for the current response before continuing.');
}
function active(chat: {status:string}) {
  if (chat.status !== 'active') throw new ApiError(409,'chat_ended','This conversation is saved. Start a new chat to continue shopping.');
}
async function cartItems(tx: Tx, cart: Cart) {
  const items: Item[] = [];
  for (const [id,quantity] of Object.entries(cart).sort(([a],[b])=>a.localeCompare(b))) {
    requireCurrentCatalog(id);
    const product = await getProduct(tx,id);
    if (!product || ('is_active' in product && !product.is_active) || product.stock < quantity) throw new ApiError(409,'stock_changed','A product is unavailable or has insufficient stock. Update your cart.');
    items.push({id:product.id,name:product.name,price_minor:product.price_minor,quantity});
  }
  return items;
}
export async function addAddress(session: AuthSession, body: unknown) {
  const details = addressSchema.parse(body);
  const address = await transaction(async tx => {
    const count = await tx.address.count({where:{customer_id:session.customer_id}});
    if (count >= 20) throw new ApiError(400,'address_limit','You have reached the saved address limit.');
    return tx.address.create({data:{customer_id:session.customer_id,details:jsonData(details)}});
  });
  const all = await db.address.findMany({where:{customer_id:session.customer_id},orderBy:{created_at:'desc'}});
  return {address:{id:address.id,...details},addresses:all.map(a=>({id:a.id,...json<object>(a.details)}))};
}
export async function prepareCheckout(session: AuthSession, body: unknown, config: Config) {
  const {address_id} = z.object({address_id:idSchema}).strict().parse(body);
  return transaction(async tx => {
    const chat = await ownedChat(tx,session.chat_id,session.customer_id); assertNotBusy(chat); active(chat);
    const customer = await tx.customer.findUnique({where:{id:session.customer_id}});
    if (!customer?.email_verified_at || !customer.phone || customer.name === 'Customer') throw new ApiError(400,'profile_required','Complete your name and mobile number before checkout.');
    const address = await tx.address.findFirst({where:{id:address_id,customer_id:session.customer_id}});
    if (!address) throw new ApiError(404,'not_found','Choose one of your saved addresses.');
    const delivery = addressSchema.parse(address.details);
    const items = await cartItems(tx,json<Cart>(chat.cart));
    if (!items.length) throw new ApiError(400,'empty_cart','Add a product to your cart first.');
    const summary: Summary = {items,delivery,address:[delivery.recipient_name,delivery.phone,delivery.line1,delivery.line2,delivery.landmark,delivery.city,delivery.state,delivery.pincode,'India'].filter(Boolean).join(', '),currency:'INR',delivery_minor:config.deliveryMinor,total_minor:items.reduce((sum,item)=>sum+item.price_minor*item.quantity,config.deliveryMinor),payment_method:'pay_on_delivery'};
    const pending: Pending = {token:randomUUID(),kind:'order',expires:Date.now()+5*60*1000,summary};
    const answer = 'Please review your items and delivery details, then use Confirm order to place your pay-on-delivery order.';
    await tx.chat.update({where:{id:chat.id},data:{pending:jsonData(pending),messages:jsonData([...json<Message[]>(chat.messages),{role:'assistant',content:answer}])}});
    return {answer,pending};
  });
}
export async function lookupOrder(tx: Tx, customerId: string, orderId: string) {
  const order = await tx.order.findFirst({where:{id:orderId,customer_id:customerId}});
  if (!order) throw new ApiError(404,'not_found','The requested order is unavailable.');
  const items = await tx.orderItem.findMany({where:{order_id:order.id}});
  const {request_id:_requestId,customer_id:_customerId,...publicOrder}=order;
  return {...publicOrder,items:items.map(item=>({...item,product_id:item.live_product_id != null ? `public:${item.live_product_id}` : item.product_id!}))};
}
async function prepareCancellation(tx: Tx, customerId: string, chatId: string, orderId: string) {
  const chat = await ownedChat(tx,chatId,customerId); active(chat);
  const order = await lookupOrder(tx,customerId,orderId);
  if (!canCancel(order.status)) throw new ApiError(409,'cannot_cancel','This order has been dispatched, completed, or cancelled and cannot be cancelled.');
  const pending = {token:randomUUID(),kind:'cancel',order_id:order.id,expires:Date.now()+5*60*1000,summary:{order_id:order.id,items:order.items,total_minor:order.total_minor,currency:order.currency,status:order.status}};
  await tx.chat.update({where:{id:chat.id},data:{pending:jsonData(pending)}});
  return {answer:'Review this order and use Confirm cancellation if you want to cancel it.',pending};
}
export async function prepareCancel(session: AuthSession, body: unknown) {
  const {order_id} = z.object({order_id:idSchema}).strict().parse(body);
  return transaction(async tx=>{ assertNotBusy(await ownedChat(tx,session.chat_id,session.customer_id)); return prepareCancellation(tx,session.customer_id,session.chat_id,order_id); });
}
export async function confirm(session: AuthSession, body: unknown, config: Config) {
  const {confirmation_id} = z.object({confirmation_id:z.string().uuid()}).strict().parse(body);
  return transaction(async tx => {
    const chat = await ownedChat(tx,session.chat_id,session.customer_id); assertNotBusy(chat); active(chat);
    const previous = await tx.order.findFirst({where:{request_id:confirmation_id,customer_id:session.customer_id}});
    if (previous) return {answer:`Order ${previous.id} has status: ${previous.status}.`,pending:{},result:{order_id:previous.id,status:previous.status}};
    const receipt = await tx.orderEvent.findUnique({where:{id:confirmation_id}});
    if (receipt?.event === 'cancelled') {
      const previousCancellation = await tx.order.findFirst({where:{id:receipt.order_id,customer_id:session.customer_id}});
      if (previousCancellation) return {answer:`Order ${previousCancellation.id} has been cancelled.`,pending:{},result:{order_id:previousCancellation.id,status:'cancelled'}};
    }
    const pending = json<Pending>(chat.pending);
    if (pending.token !== confirmation_id || !pending.expires || pending.expires <= Date.now()) throw new ApiError(409,'confirmation_expired','This confirmation has expired or changed. Prepare the action again.');
    let result: Record<string,unknown>, answer: string;
    if (pending.kind === 'cancel') {
      const order = await lookupOrder(tx,session.customer_id,pending.order_id!);
      if (!canCancel(order.status)) throw new ApiError(409,'cannot_cancel','The order is no longer eligible for cancellation.');
      const changed = await tx.order.updateMany({where:{id:order.id,customer_id:session.customer_id,status:{in:['confirmed','preparing']}},data:{status:'cancelled'}});
      if (changed.count !== 1) throw new ApiError(409,'cannot_cancel','The order is no longer eligible for cancellation.');
      for (const item of order.items) await restoreStock(tx,item.product_id,item.quantity);
      await tx.orderEvent.create({data:{id:confirmation_id,order_id:order.id,event:'cancelled',created_at:now()}});
      result = {order_id:order.id,status:'cancelled'}; answer = `Order ${order.id} has been cancelled.`;
    } else if (pending.kind === 'order' && pending.summary) {
      const summary = pending.summary;
      const items = await cartItems(tx,json<Cart>(chat.cart));
      const sameItems = items.length === summary.items.length && items.every((item,index)=>{
        const saved=summary.items[index];
        return item.id===saved.id && item.name===saved.name && item.quantity===saved.quantity && item.price_minor===saved.price_minor;
      });
      if (!sameItems || config.deliveryMinor !== summary.delivery_minor) throw new ApiError(409,'order_changed','Prices, stock or delivery charges changed. Review a new order summary.');
      addressSchema.parse(summary.delivery);
      const orderId = randomUUID();
      for (const item of items) {
        const changed = await reserveStock(tx,item);
        if (changed.count !== 1) throw new ApiError(409,'stock_changed','Product details changed. Review your order again.');
      }
      await tx.order.create({data:{id:orderId,customer_id:session.customer_id,request_id:confirmation_id,status:'confirmed',total_minor:summary.total_minor,currency:'INR',address:summary.address,delivery_details:jsonData(summary.delivery),created_at:now(),payment_method:'pay_on_delivery'}});
      await tx.orderItem.createMany({data:items.map(item=>({id:randomUUID(),order_id:orderId,product_id:isLiveId(item.id)?null:item.id,live_product_id:isLiveId(item.id)?Number(item.id.slice(7)):null,name:item.name,quantity:item.quantity,price_minor:item.price_minor}))});
      await tx.orderEvent.create({data:{id:randomUUID(),order_id:orderId,event:'confirmed',created_at:now()}});
      result = {order_id:orderId,status:'confirmed',total_minor:summary.total_minor,payment_method:'pay_on_delivery'};
      answer = `Order ${orderId} is confirmed. Payment is due on delivery. Thank you for shopping with Veyrix!`;
    } else throw new ApiError(409,'invalid_confirmation','Prepare the action again.');
    await tx.chat.update({where:{id:chat.id},data:{pending:{},...(pending.kind === 'order' ? {cart:{}} : {}),messages:jsonData([...json<Message[]>(chat.messages),{role:'assistant',content:answer}])}});
    return {answer,pending:{},result};
  });
}
export async function tool(body: unknown) {
  const input = z.object({chat_id:z.string().uuid(),customer_id:idSchema,turn_id:z.string().uuid(),name:z.string(),args:z.record(z.string(),z.unknown()).default({})}).strict().parse(body);
  return transaction(async tx => {
    const chat = await ownedChat(tx,input.chat_id,input.customer_id); active(chat);
    if (chat.lease_token !== input.turn_id || !chat.lease_until || chat.lease_until.getTime() <= Date.now()) throw new ApiError(409,'turn_expired','This conversation turn has expired.');
    if (!await tx.authSession.findFirst({where:{chat_id:chat.id,customer_id:input.customer_id,expires_at:{gt:new Date()}}})) throw new ApiError(401,'verification_required','Email verification has expired.');
    const args = input.args;
    switch (input.name) {
      case 'product_search': {
        const a = z.object({query:z.string().max(250).default(''),max_price_minor:z.number().int().nonnegative().nullable().optional()}).parse(args);
        const where={OR:['name','description','category'].map(key=>({[key]:{contains:a.query,mode:'insensitive' as const}})),...(a.max_price_minor!=null?{price_minor:{lte:a.max_price_minor}}:{})};
        return liveCatalog()?tx.liveProduct.findMany({where:{...where,is_active:true},take:30}):tx.product.findMany({where,take:30});
      }
      case 'product_details': {
        const id=idSchema.parse(args.product_id); requireCurrentCatalog(id); const p=await getProduct(tx,id);
        if (!p || ('is_active' in p && !p.is_active)) throw new ApiError(404,'not_found','Product not found.'); return {...p,currency:'INR'};
      }
      case 'product_reviews': {
        const product_id=idSchema.parse(args.product_id); requireCurrentCatalog(product_id);
        const [reviews,stats]=isLiveId(product_id) ? await Promise.all([tx.liveReview.findMany({where:{product_id},take:100}),tx.liveReview.aggregate({where:{product_id},_avg:{rating:true},_count:true})]) : await Promise.all([tx.review.findMany({where:{product_id},take:100}),tx.review.aggregate({where:{product_id},_avg:{rating:true},_count:true})]);
        return {reviews,average:stats._avg.rating,count:stats._count};
      }
      case 'cart_view': { const items=await cartItems(tx,json<Cart>(chat.cart)); return {items,total_minor:items.reduce((n,i)=>n+i.price_minor*i.quantity,0),currency:'INR'}; }
      case 'cart_add': case 'cart_remove': case 'cart_clear': {
        const cart=json<Cart>(chat.cart);
        if(input.name==='cart_clear') Object.keys(cart).forEach(k=>delete cart[k]);
        else {
          const id=idSchema.parse(args.product_id);
          if(input.name==='cart_remove') delete cart[id];
          else {
            const quantity=z.number().int().min(1).max(99).parse(args.quantity);
            requireCurrentCatalog(id);
            const product=await getProduct(tx,id);
            const total=quantity;
            if(!product || ('is_active' in product && !product.is_active) || product.stock<total || total>99) throw new ApiError(400,'invalid_quantity','That quantity is unavailable.');
            if(Object.keys(cart).length>=50 && !cart[id]) throw new ApiError(400,'cart_limit','Your cart has too many different products.');
            cart[id]=total;
          }
        }
        await tx.chat.update({where:{id:chat.id},data:{cart:jsonData(cart),pending:{}}});
        return {items:await cartItems(tx,cart),currency:'INR'};
      }
      case 'order_history': {
        const orderId=args.order_id ? idSchema.parse(args.order_id) : '';
        if (orderId) return [await lookupOrder(tx,input.customer_id,orderId)];
        const orders=await tx.order.findMany({where:{customer_id:input.customer_id},orderBy:{created_at:'desc'},take:20});
        return orders.map(({request_id:_requestId,customer_id:_customerId,...order})=>order);
      }
      case 'prepare_order': return {action:'checkout',instruction:'Choose a saved delivery address or add a new address using the delivery form.'};
      case 'prepare_cancellation': {
        const prepared=await prepareCancellation(tx,input.customer_id,input.chat_id,idSchema.parse(args.order_id));
        return {summary:prepared.pending.summary,instruction:prepared.answer};
      }
      default: throw new ApiError(400,'unknown_tool','This shopping action is unavailable.');
    }
  });
}
export async function chat(session: AuthSession, body: unknown, config: Config) {
  const {message}=z.object({message:z.string().trim().min(1).max(8000)}).strict().parse(body);
  const lease=randomUUID();
  const before=await transaction(async tx=>{
    const current=await ownedChat(tx,session.chat_id,session.customer_id); active(current); assertNotBusy(current);
    await tx.chat.update({where:{id:current.id},data:{lease_token:lease,lease_until:new Date(Date.now()+180000)}});
    return current;
  });
  try {
    const history=json<Message[]>(before.messages).slice(-20).map(entry=>({...entry,content:entry.content.slice(0,8000)}));
    const payload={chat_id:before.id,customer_id:session.customer_id,turn_id:lease,message,history};
    while(history.length && Buffer.byteLength(JSON.stringify(payload),'utf8')>128*1024) history.shift();
    const response=await fetch(new URL('/api/respond',config.pythonUrl),{method:'POST',headers:{Authorization:`Bearer ${config.pythonKey}`,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(150000)});
    if(!response.ok) throw new ApiError(503,'provider_unavailable','The shopping assistant is unavailable. Please try again.');
    const result=z.object({answer:z.string().max(32000),action:z.enum(['checkout']).optional()}).parse(await response.json());
    return await transaction(async tx=>{
      const current=await ownedChat(tx,session.chat_id,session.customer_id);
      if(current.lease_token!==lease) throw new ApiError(409,'request_expired','The conversation request expired. Please try again.');
      await tx.chat.update({where:{id:current.id},data:{messages:jsonData([...json<Message[]>(current.messages),{role:'user',content:message},{role:'assistant',content:result.answer}]),lease_token:null,lease_until:null}});
      return {...result,pending:current.pending,chat_id:current.id};
    });
  } catch(error) {
    if(error instanceof ApiError) throw error;
    throw new ApiError(503,'provider_unavailable','The shopping assistant is unavailable. Please try again.');
  } finally {await db.chat.updateMany({where:{id:before.id,lease_token:lease},data:{lease_token:null,lease_until:null}});}
}
