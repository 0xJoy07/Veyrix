import type { Response } from 'express';
import { z } from 'zod';
import { ApiError } from './security.js';
import type { ChatStage } from './commerce.js';

/** Send only fixed progress and a committed, sanitized answer, never model tokens. */
export async function streamChat<T>(res: Response, work: (progress: (stage: ChatStage) => void) => Promise<T>) {
  res.status(200);
  res.set({'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-store','X-Accel-Buffering':'no','X-Content-Type-Options':'nosniff'});
  res.flushHeaders();
  let disconnected=false;
  const onClose=()=>{disconnected=true;};
  res.on('close',onClose);
  const send=(event:string,data:unknown)=>{
    if(!disconnected && !res.writableEnded && !res.destroyed) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  const heartbeat=setInterval(()=>{
    if(!disconnected && !res.writableEnded && !res.destroyed) res.write(': keepalive\n\n');
  },15000);
  heartbeat.unref();
  try {
    send('status',{stage:'checking'});
    // A disconnected browser must not cancel persistence after a cart tool ran.
    // The normal turn lease remains active; never silently retry a mutation.
    const result=await work(stage=>{
      if(['checking','working','saving'].includes(stage)) send('status',{stage});
    });
    send('result',result);
  } catch(error) {
    const failure=error instanceof ApiError ? {code:error.code,message:error.message}
      : error instanceof z.ZodError ? {code:'invalid_request',message:'Check the required fields and their format.'}
      : {code:'service_unavailable',message:'The reply could not be completed. Reload this conversation to check its saved state before retrying.'};
    send('error',{error:failure});
  } finally {
    clearInterval(heartbeat);
    res.off('close',onClose);
    if(!disconnected && !res.writableEnded && !res.destroyed) res.end();
  }
}
