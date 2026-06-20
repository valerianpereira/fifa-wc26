/**
 * fifa-wc26 football-data.org proxy (Vercel Edge Function)
 *
 * Forwards a whitelisted subset of api.football-data.org v4 endpoints
 * with the secret X-Auth-Token attached server-side. Token never ships
 * to CLI users.
 *
 * Routing: `vercel.json` rewrites public paths (`/competitions/...`,
 * `/matches/...`, `/teams/...`, `/health`) to `/api/proxy?p=<path>`,
 * so the CLI URL shape mirrors the upstream API while a single static
 * function handles everything (Vercel catch-all routes are flaky for
 * multi-segment paths under the Edge runtime).
 */

export const config = { runtime: 'edge' };

const UPSTREAM = 'https://api.football-data.org/v4';

const ALLOW: Array<{ re: RegExp; ttl: number }> = [
  { re: /^\/competitions\/WC\/matches$/, ttl: 300 },
  { re: /^\/competitions\/WC\/standings$/, ttl: 300 },
  { re: /^\/competitions\/WC\/teams$/, ttl: 86400 },
  { re: /^\/matches\/\d+$/, ttl: 30 },
  { re: /^\/teams\/\d+$/, ttl: 86400 },
];

function matchAllowed(pathname: string): { ttl: number } | null {
  for (const a of ALLOW) if (a.re.test(pathname)) return { ttl: a.ttl };
  return null;
}

function corsHeaders(origin: string | null): Record<string, string> {
  const env = (globalThis as { process?: { env?: { ALLOWED_ORIGINS?: string } } }).process?.env;
  const allowedRaw = env?.ALLOWED_ORIGINS ?? '';
  if (!allowedRaw || !origin) return {};
  const allowed = allowedRaw.split(',').map((s) => s.trim());
  if (!allowed.includes(origin) && !allowed.includes('*')) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'vary': 'origin',
  };
}

function json(status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...extra },
  });
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const cors = corsHeaders(req.headers.get('origin'));

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return json(405, { error: 'method not allowed' }, cors);
  }

  const rawP = url.searchParams.get('p') ?? '';
  const pathname = rawP ? (rawP.startsWith('/') ? rawP : `/${rawP}`) : '/';
  const forwardQs = new URLSearchParams();
  for (const [k, v] of url.searchParams.entries()) {
    if (k !== 'p') forwardQs.append(k, v);
  }
  const search = forwardQs.toString() ? `?${forwardQs.toString()}` : '';

  if (pathname === '/' || pathname === '/health') {
    return json(200, { ok: true, upstream: 'football-data.org' }, cors);
  }

  const env = (globalThis as { process?: { env?: { FOOTBALL_DATA_TOKEN?: string } } }).process?.env;
  const token = env?.FOOTBALL_DATA_TOKEN;
  if (!token) {
    return json(500, { error: 'proxy misconfigured: FOOTBALL_DATA_TOKEN env unset' }, cors);
  }

  const allow = matchAllowed(pathname);
  if (!allow) return json(404, { error: 'path not allowed', path: pathname }, cors);

  const upstreamUrl = `${UPSTREAM}${pathname}${search}`;
  const upstream = await fetch(upstreamUrl, {
    headers: { 'X-Auth-Token': token, accept: 'application/json' },
  });

  const h = new Headers();
  h.set('content-type', upstream.headers.get('content-type') ?? 'application/json');
  if (upstream.ok) {
    h.set('cache-control', `public, s-maxage=${allow.ttl}, stale-while-revalidate=60`);
  } else {
    h.set('cache-control', 'no-store');
  }
  for (const [k, v] of Object.entries(cors)) h.set(k, v);

  const body = await upstream.arrayBuffer();
  return new Response(body, { status: upstream.status, headers: h });
}
