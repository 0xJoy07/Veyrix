import express, { type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import type { Config } from './config.js';
import { ApiError, AUTH_TTL_MS, equal, normalizePhone } from './security.js';
import { db, transaction, ownedChat, json, jsonData, type Message } from './store.js';
import { validSender } from './email.js';
import { account, authenticate, startAuth, verifyAuth } from './auth.js';
import { addAddress, assertNotBusy, chat, confirm, lookupOrder, prepareCancel, prepareCheckout, tool } from './commerce.js';

export function createApp(config: Config) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req,res,next)=>{
    const started=performance.now();
    res.on('finish',()=>console.log(`[node] ${new Date().toISOString()} ${req.method} ${req.route?.path || 'unmatched'} ${res.statusCode} ${Math.round(performance.now()-started)}ms`));
    next();
  });
  app.use(express.json({limit:'64kb'}));
  app.use((req,res,next)=>{
    res.setHeader('Cache-Control','no-store'); res.setHeader('X-Content-Type-Options','nosniff');
    if(req.path.startsWith('/api/') && !['GET','HEAD'].includes(req.method)) {
      const origin=req.headers.origin;
      if((origin && origin!==config.publicOrigin) || req.headers['sec-fetch-site']==='cross-site') return next(new ApiError(403,'invalid_origin','Cross-origin requests are not allowed.'));
    }
    next();
  });
  const cookieOptions = {httpOnly:true,sameSite:'strict' as const,secure:config.cookieSecure,path:'/',maxAge:AUTH_TTL_MS};
  app.get('/api/health',async (_req,res,next)=>{
    try { await db.$queryRaw`SELECT 1`; res.json({status:'ok',catalog_source:process.env.CATALOG_SOURCE === 'legacy' ? 'legacy' : 'public.products',email_configured:!!config.resendApiKey && validSender(config.resendFrom) && !config.resendFrom.includes('YOUR_VERIFIED_DOMAIN')}); }
    catch {next(new ApiError(503,'database_unavailable','The commerce database is unavailable.'));}
  });
  app.post('/api/auth/start',async (req,res)=>{res.json(await startAuth(req.body,req.ip || 'unknown',config));});
  app.post('/api/auth/verify',async (req,res)=>{
    const {rawToken,session}=await verifyAuth(req.body,config);
    res.cookie('veyrix_session',rawToken,cookieOptions);
    res.json(await account(session));
  });
  app.get('/api/account',async (req,res)=>{
    try {res.json(await account(await authenticate(req.headers.cookie)));}
    catch(error) {if(error instanceof ApiError && error.status===401) res.json({authenticated:false}); else throw error;}
  });
  app.post('/api/auth/logout',async (req,res)=>{
    try {const session=await authenticate(req.headers.cookie); await db.authSession.deleteMany({where:{token_hash:session.token_hash}});}
    catch(error) {if(!(error instanceof ApiError && error.status===401)) throw error;}
    res.clearCookie('veyrix_session',{...cookieOptions,maxAge:undefined}); res.json({ok:true});
  });
  app.post('/api/account/profile',async (req,res)=>{
    const session=await authenticate(req.headers.cookie);
    const data=z.object({name:z.string().trim().min(2).max(250),phone:z.string().transform(normalizePhone)}).strict().parse(req.body);
    await transaction(async tx=>{
      const conflict=await tx.customer.findFirst({where:{phone:data.phone,id:{not:session.customer_id}}});
      if(conflict) throw new ApiError(409,'profile_conflict','These contact details cannot be used. Please contact support.');
      await tx.customer.update({where:{id:session.customer_id},data});
    });
    res.json(await account(session));
  });
  app.post('/api/addresses',async (req,res)=>{res.json(await addAddress(await authenticate(req.headers.cookie),req.body));});
  app.post('/api/checkout/prepare',async (req,res)=>{res.json(await prepareCheckout(await authenticate(req.headers.cookie),req.body,config));});
  app.post('/api/chat',async (req,res)=>{
    const session=await authenticate(req.headers.cookie), current=await account(session);
    if(current.profile_required) throw new ApiError(400,'profile_required','Complete your name and mobile number to continue.');
    res.json(await chat(session,req.body,config));
  });
  app.post('/api/chat/confirm',async (req,res)=>{res.json(await confirm(await authenticate(req.headers.cookie),req.body,config));});
  app.post('/api/chat/end',async (req,res)=>{
    const session=await authenticate(req.headers.cookie);
    res.json(await transaction(async tx=>{
      const current=await ownedChat(tx,session.chat_id,session.customer_id); assertNotBusy(current);
      const answer=`Thank you for spending a little time with Veyrix. Your conversation is safely saved. Your chat ID is ${current.id}. Keep it to revisit this chat after email verification. Until your next good find!`;
      if(current.status!=='ended') await tx.chat.update({where:{id:current.id},data:{status:'ended',pending:{},messages:jsonData([...json<Message[]>(current.messages),{role:'assistant',content:answer}])}});
      return {answer,chat_id:current.id,ended:true};
    }));
  });
  app.post('/api/chat/reset',async (req,res)=>{
    const session=await authenticate(req.headers.cookie);
    res.json(await transaction(async tx=>{
      const current=await ownedChat(tx,session.chat_id,session.customer_id); assertNotBusy(current);
      const next=await tx.chat.create({data:{customer_id:session.customer_id}});
      await tx.authSession.update({where:{token_hash:session.token_hash},data:{chat_id:next.id}});
      return {chat_id:next.id,messages:[],pending:{},ended:false};
    }));
  });
  // Restoration always starts a fresh purpose-bound OTP, never an ID-only lookup.
  app.post('/api/chat/restore',async ()=>{throw new ApiError(403,'verification_required','Request email verification for this chat ID to restore it.');});
  app.post('/api/orders/lookup',async(req,res)=>{
    const session=await authenticate(req.headers.cookie), {order_id}=z.object({order_id:z.string().min(1).max(100)}).strict().parse(req.body);
    res.json({order:await transaction(tx=>lookupOrder(tx,session.customer_id,order_id))});
  });
  app.post('/api/orders/cancel/prepare',async(req,res)=>{res.json(await prepareCancel(await authenticate(req.headers.cookie),req.body));});
  app.post('/internal/tools',async(req,res)=>{
    const supplied=req.headers.authorization || '';
    if(!equal(supplied,`Bearer ${config.internalKey}`)) throw new ApiError(401,'unauthorized','A valid internal service key is required.');
    res.json(await tool(req.body));
  });
  app.use((_req,_res,next)=>next(new ApiError(404,'not_found','Endpoint not found.')));
  app.use((error:unknown,_req:Request,res:Response,_next:NextFunction)=>{
    if(error instanceof ApiError) {res.status(error.status).json({error:{code:error.code,message:error.message}});return;}
    if(error instanceof z.ZodError || error instanceof SyntaxError) {res.status(400).json({error:{code:'invalid_request',message:'Check the required fields and their format.'}});return;}
    if(error instanceof Prisma.PrismaClientKnownRequestError && error.code==='P2002') {res.status(409).json({error:{code:'conflict',message:'These details are already in use or this action has already completed. Refresh and try again.'}});return;}
    if(typeof error==='object' && error && 'type' in error && error.type==='entity.too.large') {res.status(413).json({error:{code:'request_too_large',message:'The request is too large.'}});return;}
    // Never serialize driver/provider errors, SQL, secrets, OTPs, or personal data.
    console.error('Commerce request failed.',error instanceof Error ? error.constructor.name : 'UnknownError');
    res.status(503).json({error:{code:'service_unavailable',message:'The commerce service could not complete this request. Please try again.'}});
  });
  return app;
}
