import { describe, it, expect } from 'vitest';
import chalk from 'chalk';
import { renderFixturesPretty, renderStandingsPretty } from '../../src/render/pretty.js';
import type { Fixture, GroupStanding } from '../../src/providers/types.js';

chalk.level = 0;

describe('renderFixturesPretty', () => {
  it('returns a non-empty table that mentions team codes', () => {
    const f: Fixture = {
      id: '1', utcKickoff: '2026-06-15T18:00:00.000Z', stage: 'group', group: 'A',
      home: { code: 'MEX', name: 'Mexico' }, away: { code: 'CAN', name: 'Canada' },
      venue: 'Azteca', status: 'scheduled',
    };
    const out = renderFixturesPretty([f]);
    expect(out).toContain('MEX');
    expect(out).toContain('CAN');
    expect(out).toContain('Group A');
  });
});

describe('renderStandingsPretty', () => {
  it('renders a group header and rows', () => {
    const s: GroupStanding = {
      group: 'A',
      rows: [{ team: { code: 'MEX', name: 'Mexico' }, p: 1, w: 1, d: 0, l: 0, gf: 2, ga: 0, gd: 2, pts: 3 }],
    };
    const out = renderStandingsPretty([s]);
    expect(out).toContain('Group A');
    expect(out).toContain('MEX');
    expect(out).toContain('3');
  });
});
