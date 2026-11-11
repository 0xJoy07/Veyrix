import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { loadEnvFile } from 'node:process';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApiMiddleware } from './api.mjs';
import { loadConfig } from './config.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (existsSync(resolve(root, '.env'))) loadEnvFile(resolve(root, '.env'));
const dist = resolve(root, 'dist');
if (!existsSync(resolve(dist, 'index.html'))) throw new Error('Run npm run build before npm start.');
const api = createApiMiddleware(loadConfig());
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const server = createServer((req, res) => {
  if (req.url?.split('?')[0] === '/favicon.ico') {
    res.writeHead(302, { Location: '/favicon.svg' });
    res.end();
    return;
  }
  api(req, res, async () => {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    let path;
    try { path = resolve(dist, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname)); }
    catch { res.writeHead(400); res.end(); return; }
    if (path !== dist && !path.startsWith(dist + sep)) { res.writeHead(403); res.end(); return; }
    try { if (!(await stat(path)).isFile()) path = resolve(dist, 'index.html'); }
    catch { path = resolve(dist, 'index.html'); }
    res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
    if (req.method === 'HEAD') res.end(); else createReadStream(path).pipe(res);
  });
});
server.listen(Number(process.env.PORT || 4173), '127.0.0.1', () => console.log(`Demo chat: http://127.0.0.1:${server.address().port}`));
