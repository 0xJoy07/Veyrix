import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';

// The bridge has no credentials, customer identity, or session storage.
export function loadConfig() {
  const file = new URL('../.env', import.meta.url);
  const local = existsSync(file) ? parseEnv(readFileSync(file, 'utf8')) : {};
  const env = { ...local, ...process.env };
  return { backendUrl: env.COMMERCE_API_URL || 'http://127.0.0.1:8001' };
}
export const configFiles = [fileURLToPath(new URL('../.env', import.meta.url))];
