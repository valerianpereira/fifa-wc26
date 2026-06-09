import { describe, it, expect, vi } from 'vitest';
import { Command } from 'commander';
import { liveCmd } from '../../src/commands/live.js';
import type { LiveMatch } from '../../src/providers/types.js';

const lm: LiveMatch = {
  id: '7', utcKickoff: '2026-06-15T18:00:00.000Z', stage: 'group', group: 'A',
  home: { code: 'AAA', name: 'A' }, away: { code: 'BBB', name: 'B' },
  venue: 'V', status: 'live', minute: 23, score: { home: 1, away: 0 }, events: [],
};

vi.mock('../../src/commands/_shared.js', () => ({
  buildRegistry: async () => ({ call: async (fn: (p: { liveMatches: () => Promise<LiveMatch[]> }) => Promise<LiveMatch[]>) => fn({ liveMatches: async () => [lm] }) }),
  runCached: async (_k: string, _t: number, f: () => Promise<{ data: LiveMatch[]; provider: string }>) => ({ data: (await f()).data, stale: false }),
  die: (e: unknown) => { throw e; },
  env: {},
}));

describe('live command', () => {
  it('--json includes minute and score', async () => {
    const program = new Command(); program.option('--json');
    liveCmd(program);
    const chunks: string[] = [];
    const orig = process.stdout.write.bind(process.stdout);
    (process.stdout.write as unknown as (s: string) => boolean) = (s) => { chunks.push(s); return true; };
    try { await program.parseAsync(['node', 'wc26', 'live', '--json']); } finally { process.stdout.write = orig; }
    const out = JSON.parse(chunks.join(''));
    expect(out.data[0]).toMatchObject({ id: '7', minute: 23, score: { home: 1, away: 0 } });
  });
});
