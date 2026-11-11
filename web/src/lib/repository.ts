import { REPOSITORY_URL } from '@/content/repository';

/** Resolve the source references shown in the Python engineering guides. */
export function pythonSourceUrl(path: string) {
  const directory = path.endsWith('/') || path.includes('*');
  const relative = path.includes('*') ? path.slice(0, path.lastIndexOf('/') + 1) : path;
  return new URL(`${directory ? 'tree' : 'blob'}/main/setup/python/${relative}`, `${REPOSITORY_URL}/`).href;
}
