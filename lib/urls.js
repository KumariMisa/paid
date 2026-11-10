import { headers } from 'next/headers';

export function appBase() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  const h = headers();
  const host = h.get('x-forwarded-host') || h.get('host');
  const proto = h.get('x-forwarded-proto') || (host?.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export const connectorUrl = (key) => `${appBase()}/mcp/${key}`;
