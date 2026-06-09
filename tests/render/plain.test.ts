import { describe, it, expect } from 'vitest';
import { renderFixturesPlain, renderStandingsPlain } from '../../src/render/plain.js';
import type { Fixture, GroupStanding } from '../../src/providers/types.js';

const fx: Fixture = {
  id: '1', utcKickoff: '2026-06-15T18:00:00.000Z', stage: 'group', group: 'A',
  home: { code: 'MEX', name: 'Mexico' }, away: { code: 'CAN', name: 'Canada' },
  venue: 'Azteca', status: 'scheduled',
};

describe('renderFixturesPlain', () => {
  it('emits one TSV row per fixture with header', () => {
    const out = renderFixturesPlain([fx]);
    const lines = out.trim().split('\n');
    expect(lines[0]).toBe('id\tkickoff\tstage\tgroup\thome\taway\tvenue\tstatus\tscore');
    expect(lines[1]).toBe('1\t2026-06-15T18:00:00.000Z\tgroup\tA\tMEX\tCAN\tAzteca\tscheduled\t-');
  });
});

describe('renderStandingsPlain', () => {
  it('emits group rows TSV', () => {
    const s: GroupStanding = {
      group: 'A',
      rows: [{ team: { code: 'MEX', name: 'Mexico' }, p: 1, w: 1, d: 0, l: 0, gf: 2, ga: 0, gd: 2, pts: 3 }],
    };
    const out = renderStandingsPlain([s]).trim().split('\n');
    expect(out[0]).toBe('group\tteam\tp\tw\td\tl\tgf\tga\tgd\tpts');
    expect(out[1]).toBe('A\tMEX\t1\t1\t0\t0\t2\t0\t2\t3');
  });
});
