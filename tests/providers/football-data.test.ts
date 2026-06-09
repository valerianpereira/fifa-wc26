import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FootballDataProvider } from '../../src/providers/football-data.js';

const httpJson = vi.fn();
vi.mock('../../src/http/client.js', () => ({ httpJson: (...a: unknown[]) => httpJson(...a) }));

beforeEach(() => httpJson.mockReset());

describe('FootballDataProvider', () => {
  it('isConfigured reflects api key presence', () => {
    expect(new FootballDataProvider('').isConfigured()).toBe(false);
    expect(new FootballDataProvider('k').isConfigured()).toBe(true);
  });

  it('normalizes a matches response', async () => {
    httpJson.mockResolvedValueOnce({
      matches: [
        {
          id: 4,
          utcDate: '2026-06-15T18:00:00Z',
          stage: 'GROUP_STAGE',
          group: 'GROUP_A',
          status: 'SCHEDULED',
          venue: 'Estadio Azteca',
          homeTeam: { tla: 'MEX', name: 'Mexico' },
          awayTeam: { tla: 'CAN', name: 'Canada' },
          score: { fullTime: { home: null, away: null } },
        },
      ],
    });
    const p = new FootballDataProvider('k');
    const out = await p.fixtures({});
    expect(out[0]).toMatchObject({
      id: '4', stage: 'group', group: 'A',
      home: { code: 'MEX', name: 'Mexico' }, status: 'scheduled',
    });
    expect(httpJson).toHaveBeenCalledWith(
      expect.stringContaining('competitions/WC/matches'),
      expect.objectContaining({ headers: { 'X-Auth-Token': 'k' } }),
    );
  });
});
