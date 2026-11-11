import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';

function readEnvironment(url) {
  return existsSync(url) ? parseEnv(readFileSync(url, 'utf8')) : {};
}

// Read private configuration on the server only. Never export it through VITE_*.
export function loadConfig() {
  const backend = readEnvironment(new URL('../../setup/python/.env', import.meta.url));
  const local = readEnvironment(new URL('../.env', import.meta.url));
  const env = { ...local, ...process.env };
  return {
    backendUrl: env.SHOPPING_BACKEND_URL || 'http://127.0.0.1:8000',
    apiKey: env.SHOPPING_API_KEY || backend.SHOPPING_API_KEY || '',
    customerId: env.DEMO_CUSTOMER_ID || 'demo',
  };
}

export const configFiles = [fileURLToPath(new URL('../.env', import.meta.url)), fileURLToPath(new URL('../../setup/python/.env', import.meta.url))];
