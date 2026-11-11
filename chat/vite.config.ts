import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { createApiMiddleware } from './server/api.mjs';
import { loadConfig, configFiles } from './server/config.mjs';

export default defineConfig(() => {
  return {
    publicDir: fileURLToPath(new URL('./public', import.meta.url)),
    plugins: [react(), tailwindcss(), {
      name: 'shopping-api-bridge',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.split('?')[0] !== '/favicon.ico') return next();
          res.writeHead(302, { Location: '/favicon.svg' });
          res.end();
        });
        server.middlewares.use(createApiMiddleware(loadConfig()));
        server.watcher.add(configFiles);
        server.watcher.on('change', path => { if (configFiles.includes(path)) void server.restart(); });
      },
    }],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: { host: '127.0.0.1', port: 5174, strictPort: true },
  };
});
