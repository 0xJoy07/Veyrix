import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { Response } from 'express';
import { streamChat } from '../src/chat-stream.js';

class Sink extends EventEmitter {
  chunks:string[]=[];
  headers:Record<string,string>={};
  writableEnded=false;
  destroyed=false;
  status() {return this;}
  set(headers:Record<string,string>) {this.headers=headers;return this;}
  flushHeaders() {}
  write(chunk:string) {this.chunks.push(chunk);return true;}
  end() {this.writableEnded=true;}
}
test('chat stream sends progress before work completes and result only after commit',async()=>{
  const sink=new Sink();
  let commit!:()=>void;
  const committed=new Promise<void>(resolve=>{commit=resolve;});
  const run=streamChat(sink as unknown as Response,async progress=>{
    progress('working');
    await committed;
    progress('saving');
    return {answer:'Saved answer',pending:{}};
  });
  assert.match(sink.chunks.join(''),/"stage":"working"/);
  assert.doesNotMatch(sink.chunks.join(''),/event: result/);
  commit();await run;
  assert.equal(sink.headers['X-Accel-Buffering'],'no');
  assert.match(sink.chunks.join(''),/event: result\ndata: \{"answer":"Saved answer"/);
  assert.ok(sink.writableEnded);
});
test('stream failure never exposes SQL or provider details or a success event',async()=>{
  const sink=new Sink();
  await streamChat(sink as unknown as Response,async()=>{throw new Error('SELECT private-secret FROM customers');});
  const output=sink.chunks.join('');
  assert.match(output,/event: error/);
  assert.doesNotMatch(output,/private-secret|SELECT|event: result/);
});
test('browser disconnect does not interrupt completion or emit more customer data',async()=>{
  const sink=new Sink();let saved=false;
  await streamChat(sink as unknown as Response,async progress=>{
    sink.emit('close');
    progress('saving');saved=true;
    return {answer:'Private answer'};
  });
  assert.ok(saved);
  assert.doesNotMatch(sink.chunks.join(''),/Private answer|saving/);
  assert.equal(sink.listenerCount('close'),0);
});
