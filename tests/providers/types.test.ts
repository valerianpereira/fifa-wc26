import { describe, it, expect } from 'vitest';
import { FixtureSchema, GroupStandingSchema } from '../../src/providers/types.js';

describe('FixtureSchema', () => {
  it('accepts a valid fixture', () => {
    const ok = FixtureSchema.safeParse({
      id: '123',
      utcKickoff: '2026-06-15T18:00:00Z',
      stage: 'group',
      group: 'A',
      home: { code: 'MEX', name: 'Mexico' },
      away: { code: 'CAN', name: 'Canada' },
      venue: 'Estadio Azteca',
      status: 'scheduled',
    });
    expect(ok.success).toBe(true);
  });

  it('rejects an unknown stage', () => {
    const bad = FixtureSchema.safeParse({
      id: '1', utcKickoff: '2026-06-15T18:00:00Z', stage: 'preseason',
      home: { code: 'A', name: 'A' }, away: { code: 'B', name: 'B' },
      venue: 'X', status: 'scheduled',
    });
    expect(bad.success).toBe(false);
  });
});

describe('GroupStandingSchema', () => {
  it('parses a group with rows', () => {
    const ok = GroupStandingSchema.safeParse({
      group: 'A',
      rows: [{ team: { code: 'MEX', name: 'Mexico' }, p: 3, w: 2, d: 1, l: 0, gf: 5, ga: 2, gd: 3, pts: 7 }],
    });
    expect(ok.success).toBe(true);
  });
});
