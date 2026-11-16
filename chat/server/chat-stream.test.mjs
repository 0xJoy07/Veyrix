import test from 'node:test';
import assert from 'node:assert/strict';
import { readChatStream } from '../src/lib/chat-stream.mjs';
const encoder = new TextEncoder();
const stream = chunks => new ReadableStream({ start(controller) { for (const chunk of chunks) controller.enqueue(chunk); controller.close(); } });
test('parses UTF-8 and frame boundaries split across bytes, fixed status and final actions', async () => {
  const wire = 'event: status\r\ndata: {"stage":"working"}\r\n\r\nevent: status\ndata: {"stage":"private tool output"}\n\nevent: result\ndata: {"answer":"₹500 shoes","action":"checkout","pending":{"token":"trusted-ui-token"}}\n\n';
  const stages = [];
  const result = await readChatStream(stream([...encoder.encode(wire)].map(byte => Uint8Array.of(byte))), stage => stages.push(stage));
  assert.deepEqual(stages, ['working']);
  assert.equal(result.answer, '₹500 shoes');
  assert.equal(result.pending.token, 'trusted-ui-token');
  assert.equal(result.action, 'checkout');
});
test('rejects EOF without a complete final event including an unfinished result frame', async () => {
  for (const text of ['', 'event: status\ndata: {"stage":"saving"}\n\n', 'event: result\ndata: {"answer":"not complete"}']) {
    await assert.rejects(readChatStream(stream([encoder.encode(text)])), error => error.code === 'stream_interrupted');
  }
});
test('rejects malformed JSON, oversized frames, invalid UTF-8 and invalid final answers', async () => {
  for (const bytes of [encoder.encode('event: result\ndata: nope\n\n'), encoder.encode('x'.repeat(262145)), Uint8Array.of(255), encoder.encode('event: result\ndata: {"answer":42}\n\n')]) {
    await assert.rejects(readChatStream(stream([bytes])), error => error.code === 'stream_interrupted');
  }
});
test('propagates structured server errors without treating progress as success', async () => {
  await assert.rejects(readChatStream(stream([encoder.encode('event: error\ndata: {"error":{"code":"session_expired","message":"Verify again."}}\n\n')])), error => error.code === 'session_expired' && error.message === 'Verify again.');
});
