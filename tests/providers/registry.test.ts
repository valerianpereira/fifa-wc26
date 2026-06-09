import { describe, it, expect, vi } from 'vitest';
import { ProviderRegistry } from '../../src/providers/registry.js';
import { WC26Error } from '../../src/errors.js';
import type { Provider, Fixture } from '../../src/providers/types.js';

function stub(name: string, behavior: 'ok' | 'unreachable' | 'rate' = 'ok'): Provider {
  const fx: Fixture[] = [{
    id: name, utcKickoff: '2026-06-15T18:00:00Z', stage: 'group',
    home: { code: 'AAA', name: 'A' }, away: { code: 'BBB', name: 'B' },
    venue: 'V', status: 'scheduled',
  }];
  return {
    name, isConfigured: () => true,
    fixtures: vi.fn(async () => {
      if (behavior === 'unreachable') throw new WC26Error('PROVIDER_UNREACHABLE', 'x');
      if (behavior === 'rate') throw new WC26Error('RATE_LIMIT', 'x');
      return fx;
    }),
    liveMatches: vi.fn(), match: vi.fn(), standings: vi.fn(),
    knockoutBracket: vi.fn(), team: vi.fn(),
  } as unknown as Provider;
}

describe('ProviderRegistry', () => {
  it('uses first healthy provider', async () => {
    const a = stub('a'); const b = stub('b');
    const reg = new ProviderRegistry([a, b]);
    const out = await reg.call((p) => p.fixtures({}));
    expect(out[0]!.id).toBe('a');
    expect(b.fixtures).not.toHaveBeenCalled();
  });

  it('fails over on PROVIDER_UNREACHABLE', async () => {
    const a = stub('a', 'unreachable'); const b = stub('b');
    const reg = new ProviderRegistry([a, b]);
    const out = await reg.call((p) => p.fixtures({}));
    expect(out[0]!.id).toBe('b');
  });

  it('throws NO_PROVIDER_CONFIGURED when list empty after filtering', async () => {
    const reg = new ProviderRegistry([]);
    await expect(reg.call((p) => p.fixtures({}))).rejects.toMatchObject({ code: 'NO_PROVIDER_CONFIGURED' });
  });

  it('throws PROVIDER_UNREACHABLE when all providers fail', async () => {
    const a = stub('a', 'unreachable'); const b = stub('b', 'rate');
    const reg = new ProviderRegistry([a, b]);
    await expect(reg.call((p) => p.fixtures({}))).rejects.toMatchObject({ code: 'PROVIDER_UNREACHABLE' });
  });

  it('opens circuit after 3 consecutive failures and skips provider', async () => {
    const a = stub('a', 'unreachable'); const b = stub('b');
    const reg = new ProviderRegistry([a, b]);
    for (let i = 0; i < 3; i++) await reg.call((p) => p.fixtures({}));
    (a.fixtures as ReturnType<typeof vi.fn>).mockClear();
    const out = await reg.call((p) => p.fixtures({}));
    expect(a.fixtures).not.toHaveBeenCalled();
    expect(out[0]!.id).toBe('b');
  });
});
