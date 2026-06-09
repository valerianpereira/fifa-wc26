import { describe, it, expect, vi } from 'vitest';
import { Command } from 'commander';
import { groupsCmd } from '../../src/commands/groups.js';
import type { GroupStanding } from '../../src/providers/types.js';

const g: GroupStanding = {
  group: 'A',
  rows: [{ team: { code: 'MEX', name: 'Mexico' }, p: 1, w: 1, d: 0, l: 0, gf: 2, ga: 0, gd: 2, pts: 3 }],
};

vi.mock('../../src/commands/_shared.js', () => ({
  buildRegistry: async () => ({ call: async (fn: (p: { standings: (grp?: string) => Promise<GroupStanding[]> }) => Promise<GroupStanding[]>) => fn({ standings: async () => [g] }) }),
  runCached: async (_k: string, _t: number, f: () => Promise<{ data: GroupStanding[]; provider: string }>) => ({ data: (await f()).data, stale: false }),
  die: (e: unknown) => { throw e; },
  env: {},
}));

describe('groups command', () => {
  it('--plain emits TSV header + row', async () => {
    const program = new Command(); program.option('--plain');
    groupsCmd(program);
    const chunks: string[] = [];
    const orig = process.stdout.write.bind(process.stdout);
    (process.stdout.write as unknown as (s: string) => boolean) = (s) => { chunks.push(s); return true; };
    try { await program.parseAsync(['node', 'wc26', 'groups', '--plain']); } finally { process.stdout.write = orig; }
    const lines = chunks.join('').trim().split('\n');
    expect(lines[0]).toBe('group\tteam\tp\tw\td\tl\tgf\tga\tgd\tpts');
    expect(lines[1]).toBe('A\tMEX\t1\t1\t0\t0\t2\t0\t2\t3');
  });
});
