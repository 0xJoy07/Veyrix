const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Local host aliases may vary; protocol and configured port must still match. */
export function isAllowedOrigin(origin: string, configuredOrigin: string): boolean {
  try {
    const supplied = new URL(origin);
    const configured = new URL(configuredOrigin);
    // An Origin header is one serialized HTTP(S) origin, never a URL path,
    // credentials, opaque "null", a list, or an arbitrary subdomain.
    if (!['http:', 'https:'].includes(supplied.protocol) || supplied.origin !== origin) return false;
    if (supplied.origin === configured.origin) return true;
    return LOOPBACK_HOSTS.has(supplied.hostname) && LOOPBACK_HOSTS.has(configured.hostname)
      && supplied.protocol === configured.protocol && supplied.port === configured.port;
  } catch {
    return false;
  }
}
