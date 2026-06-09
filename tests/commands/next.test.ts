import { describe, it, expect, vi } from 'vitest';
import { Command } from 'commander';
import { nextCmd } from '../../src/commands/next.js';
import type { Fixture } from '../../src/providers/types.js';

function fx(id: string, when: string, status: Fixture['status'] = 'scheduled'): Fixture {
  return { id, utcKickoff: when, stage: 'group', group: 'A',
    home: { code: 'AAA', name: 'A' }, away: { code: 'BBB', name: 'B' },
    venue: 'V', status };
}

vi.mock('../../src/commands/_shared.js', () => ({
  buildRegistry: async () => ({}),
  runCached: async (_k: string, _t: number, f: () => Promise<{ data: Fixture[]; provider: string }>) => ({
    data: (await f()).data, stale: false,
  }),
  die: (e: unknown) => { throw e; },
  env: {},
}));

vi.mock('../../src/providers/registry.js', () => ({}));

describe('next command', () => {
  it('--json limits to -n entries and only scheduled in future', async () => {
    const past = new Date(Date.now() - 86400_000).toISOString();
    const f1 = new Date(Date.now() + 3600_000).toISOString();
    const f2 = new Date(Date.now() + 7200_000).toISOString();
    const f3 = new Date(Date.now() + 10800_000).toISOString();

    // override buildRegistry to return our stub
    const shared = await import('../../src/commands/_shared.js');
    (shared.buildRegistry as unknown) = async () => ({
      call: async (fn: (p: { fixtures: () => Promise<Fixture[]> }) => Promise<Fixture[]>) =>
        fn({ fixtures: async () => [fx('p', past, 'finished'), fx('a', f1), fx('b', f2), fx('c', f3)] }),
    });

    const program = new Command(); program.option('--json');
    nextCmd(program);
    const chunks: string[] = [];
    const orig = process.stdout.write.bind(process.stdout);
    (process.stdout.write as unknown as (s: string) => boolean) = (s) => { chunks.push(s); return true; };
    try { await program.parseAsync(['node', 'wc26', 'next', '-n', '2', '--json']); } finally { process.stdout.write = orig; }
    const out = JSON.parse(chunks.join(''));
    expect(out.data.map((f: Fixture) => f.id)).toEqual(['a', 'b']);
  });
});
