import { describe, it, expect, vi } from 'vitest';
import { Command } from 'commander';
import { matchCmd } from '../../src/commands/match.js';
import type { MatchDetail } from '../../src/providers/types.js';

const md: MatchDetail = {
  id: '7', utcKickoff: '2026-06-15T18:00:00.000Z', stage: 'group', group: 'A',
  home: { code: 'AAA', name: 'A' }, away: { code: 'BBB', name: 'B' },
  venue: 'V', status: 'live', minute: 23, events: [],
  lineups: { home: [], away: [] }, stats: {},
};

vi.mock('../../src/commands/_shared.js', () => ({
  buildRegistry: async () => ({ call: async (fn: (p: { match: (id: string) => Promise<MatchDetail> }) => Promise<MatchDetail>) => fn({ match: async () => md }) }),
  runCached: async (_k: string, _t: number, f: () => Promise<{ data: MatchDetail; provider: string }>) => ({ data: (await f()).data, stale: false }),
  die: (e: unknown) => { throw e; },
  env: {},
}));

describe('match command', () => {
  it('--json returns the detail by id', async () => {
    const program = new Command(); program.option('--json');
    matchCmd(program);
    const chunks: string[] = [];
    const orig = process.stdout.write.bind(process.stdout);
    (process.stdout.write as unknown as (s: string) => boolean) = (s) => { chunks.push(s); return true; };
    try { await program.parseAsync(['node', 'wc26', 'match', '7', '--json']); } finally { process.stdout.write = orig; }
    expect(JSON.parse(chunks.join('')).data.id).toBe('7');
  });
});
