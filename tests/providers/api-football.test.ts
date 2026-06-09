import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiFootballProvider } from '../../src/providers/api-football.js';

const httpJson = vi.fn();
vi.mock('../../src/http/client.js', () => ({ httpJson: (...a: unknown[]) => httpJson(...a) }));

beforeEach(() => httpJson.mockReset());

describe('ApiFootballProvider', () => {
  it('reports configured only when api key is set', () => {
    expect(new ApiFootballProvider('').isConfigured()).toBe(false);
    expect(new ApiFootballProvider('key').isConfigured()).toBe(true);
  });

  it('normalizes a fixtures response', async () => {
    httpJson.mockResolvedValueOnce({
      response: [
        {
          fixture: { id: 99, date: '2026-06-15T18:00:00+00:00', status: { short: 'NS' }, venue: { name: 'Azteca' } },
          league: { round: 'Group Stage - 1', season: 2026 },
          teams: {
            home: { id: 1, name: 'Mexico', code: 'MEX' },
            away: { id: 2, name: 'Canada', code: 'CAN' },
          },
          goals: { home: null, away: null },
        },
      ],
    });
    const p = new ApiFootballProvider('key');
    const out = await p.fixtures({});
    expect(out).toEqual([
      {
        id: '99',
        utcKickoff: '2026-06-15T18:00:00.000Z',
        stage: 'group',
        group: undefined,
        home: { code: 'MEX', name: 'Mexico' },
        away: { code: 'CAN', name: 'Canada' },
        venue: 'Azteca',
        status: 'scheduled',
        score: undefined,
      },
    ]);
    expect(httpJson).toHaveBeenCalledWith(
      expect.stringContaining('/fixtures?'),
      expect.objectContaining({ headers: expect.objectContaining({ 'x-apisports-key': 'key' }) }),
    );
  });

  it('normalizes a live response into LiveMatch', async () => {
    httpJson.mockResolvedValueOnce({
      response: [
        {
          fixture: { id: 7, date: '2026-06-15T18:00:00+00:00', status: { short: '1H', elapsed: 23 }, venue: { name: 'V' } },
          league: { round: 'Round of 16', season: 2026 },
          teams: { home: { name: 'A', code: 'AAA' }, away: { name: 'B', code: 'BBB' } },
          goals: { home: 1, away: 0 },
          events: [{ time: { elapsed: 12 }, type: 'Goal', team: { name: 'A' }, player: { name: 'X' }, detail: 'Normal Goal' }],
        },
      ],
    });
    const p = new ApiFootballProvider('key');
    const out = await p.liveMatches();
    expect(out[0].minute).toBe(23);
    expect(out[0].score).toEqual({ home: 1, away: 0 });
    expect(out[0].stage).toBe('r16');
    expect(out[0].events[0]).toMatchObject({ minute: 12, type: 'goal', team: 'home', player: 'X' });
  });
});
