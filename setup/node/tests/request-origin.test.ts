import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { isAllowedOrigin } from '../src/request-origin.js';
import { createApp } from '../src/app.js';
import type { Config } from '../src/config.js';

test('local aliases match only the configured protocol and port',()=>{
  for(const host of ['localhost','127.0.0.1','[::1]']) {
    assert.equal(isAllowedOrigin(`http://${host}:5174`,'http://127.0.0.1:5174'),true);
    assert.equal(isAllowedOrigin(`http://${host}:4173`,'http://localhost:4173'),true);
  }
  for(const origin of ['http://localhost:4173','http://localhost:5173','https://localhost:5174',
    'https://attacker.example','http://localhost.attacker.example:5174','http://127.0.0.2:5174',
    'null','file://localhost','http://user:password@localhost:5174','http://localhost:5174/',
    'http://localhost:5174/path','http://localhost:5174?query=1','http://localhost:5174#fragment',
    'http://localhost:5174 https://attacker.example']) {
    assert.equal(isAllowedOrigin(origin,'http://127.0.0.1:5174'),false,origin);
  }
});

test('production origins do not inherit loopback or subdomain permissions',()=>{
  const configured='https://shop.example';
  assert.equal(isAllowedOrigin(configured,configured),true);
  for(const origin of ['http://shop.example','https://other.shop.example','https://shop.example:8443',
    'http://localhost:5174','https://localhost','https://attacker.example']) {
    assert.equal(isAllowedOrigin(origin,configured),false);
  }
});

test('login HTTP route accepts local alias then validates input, but blocks foreign origins before auth',async t=>{
  const config={publicOrigin:'http://127.0.0.1:5174',cookieSecure:false,resendApiKey:'test-only',resendFrom:'Veyrix <verify@example.test>'} as Config;
  const server=createApp(config).listen(0,'127.0.0.1');
  await once(server,'listening');
  t.after(()=>new Promise<void>(resolve=>{server.close(()=>resolve());server.closeAllConnections();}));
  const address=server.address();assert.ok(address && typeof address!=='string');
  const url=`http://127.0.0.1:${address.port}/api/auth/start`;
  const send=(origin:string,site='same-origin')=>fetch(url,{
    method:'POST',headers:{'Content-Type':'application/json',Origin:origin,'Sec-Fetch-Site':site},body:'{}',
  });
  // Empty data fails Zod validation before database access or email delivery.
  for(const origin of ['http://127.0.0.1:5174','http://localhost:5174','http://[::1]:5174']) {
    const response=await send(origin);
    assert.equal(response.status,400);
    assert.equal((await response.json()).error.code,'invalid_request');
    assert.equal(response.headers.get('access-control-allow-origin'),null);
  }
  for(const [origin,site] of [['https://attacker.example','same-origin'],['http://localhost:4173','same-origin'],['http://localhost:5174','cross-site']]) {
    const response=await send(origin,site);
    assert.equal(response.status,403);
    assert.equal((await response.json()).error.code,'invalid_origin');
    assert.equal(response.headers.get('set-cookie'),null);
  }
});
