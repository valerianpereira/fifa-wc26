import { fetch } from 'undici';
import { WC26Error } from '../errors.js';

export interface HttpOpts {
  headers?: Record<string, string>;
  retries?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
}

const TRANSIENT = new Set([408, 429, 500, 502, 503, 504]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function httpJson<T = unknown>(url: string, opts: HttpOpts = {}): Promise<T> {
  const retries = opts.retries ?? 3;
  const base = opts.baseDelayMs ?? 1000;

  let attempt = 0;
  let lastErr: unknown;

  while (attempt <= retries) {
    try {
      const res = await fetch(url, {
        headers: opts.headers,
        signal: opts.timeoutMs ? AbortSignal.timeout(opts.timeoutMs) : undefined,
      });

      if (res.ok) return (await res.json()) as T;

      if (res.status === 404) {
        throw new WC26Error('NOT_FOUND', `not found: ${url}`);
      }

      if (!TRANSIENT.has(res.status)) {
        throw new WC26Error('PROVIDER_UNREACHABLE', `http ${res.status}: ${url}`);
      }

      lastErr =
        res.status === 429
          ? new WC26Error('RATE_LIMIT', `rate limited: ${url}`)
          : new WC26Error('PROVIDER_UNREACHABLE', `http ${res.status}: ${url}`);

      if (attempt === retries) throw lastErr;

      const retryAfter = res.headers.get('retry-after');
      const delay = retryAfter ? Number(retryAfter) * 1000 : base * 2 ** attempt;
      await sleep(Math.max(0, delay));
    } catch (e) {
      if (e instanceof WC26Error && (e.code === 'NOT_FOUND' || attempt === retries)) throw e;
      if (!(e instanceof WC26Error)) {
        lastErr = new WC26Error('PROVIDER_UNREACHABLE', `network error: ${url}`, e);
        if (attempt === retries) throw lastErr;
        await sleep(base * 2 ** attempt);
      } else {
        lastErr = e;
      }
    }
    attempt++;
  }
  throw lastErr ?? new WC26Error('PROVIDER_UNREACHABLE', `exhausted retries: ${url}`);
}
