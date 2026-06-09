import { describe, it, expect, vi, beforeEach } from 'vitest';
import { httpJson } from '../../src/http/client.js';

const fetchMock = vi.fn();
vi.mock('undici', () => ({ fetch: (...a: unknown[]) => fetchMock(...a) }));

function response(status: number, body: unknown, headers: Record<string, string> = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

beforeEach(() => fetchMock.mockReset());

describe('httpJson', () => {
  it('returns parsed body on 2xx', async () => {
    fetchMock.mockResolvedValueOnce(response(200, { ok: true }));
    const r = await httpJson('https://x/y');
    expect(r).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('retries on 429 honoring Retry-After', async () => {
    fetchMock
      .mockResolvedValueOnce(response(429, {}, { 'retry-after': '0' }))
      .mockResolvedValueOnce(response(200, { ok: true }));
    const r = await httpJson('https://x/y', { retries: 1, baseDelayMs: 0 });
    expect(r).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws WC26Error RATE_LIMIT after exhausting retries on 429', async () => {
    fetchMock.mockResolvedValue(response(429, {}));
    await expect(httpJson('https://x/y', { retries: 2, baseDelayMs: 0 })).rejects.toMatchObject({
      code: 'RATE_LIMIT',
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('throws PROVIDER_UNREACHABLE on 5xx after retries', async () => {
    fetchMock.mockResolvedValue(response(503, {}));
    await expect(httpJson('https://x/y', { retries: 1, baseDelayMs: 0 })).rejects.toMatchObject({
      code: 'PROVIDER_UNREACHABLE',
    });
  });

  it('throws PROVIDER_UNREACHABLE on network errors', async () => {
    fetchMock.mockRejectedValueOnce(Object.assign(new Error('boom'), { code: 'ECONNREFUSED' }));
    await expect(httpJson('https://x/y', { retries: 0, baseDelayMs: 0 })).rejects.toMatchObject({
      code: 'PROVIDER_UNREACHABLE',
    });
  });

  it('throws NOT_FOUND on 404 (no retry)', async () => {
    fetchMock.mockResolvedValue(response(404, {}));
    await expect(httpJson('https://x/y', { retries: 3, baseDelayMs: 0 })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
