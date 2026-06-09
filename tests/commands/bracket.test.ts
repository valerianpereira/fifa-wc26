import { describe, it, expect, vi } from 'vitest';
import { Command } from 'commander';
import { bracketCmd } from '../../src/commands/bracket.js';
import type { BracketNode } from '../../src/providers/types.js';

const nodes: BracketNode[] = [
  { stage: 'r16', matchId: '1', home: { code: 'ARG', name: 'A' }, away: { code: 'BRA', name: 'B' } },
];

vi.mock('../../src/commands/_shared.js', () => ({
  buildRegistry: async () => ({ call: async (fn: (p: { knockoutBracket: () => Promise<BracketNode[]> }) => Promise<BracketNode[]>) => fn({ knockoutBracket: async () => nodes }) }),
  runCached: async (_k: string, _t: number, f: () => Promise<{ data: BracketNode[]; provider: string }>) => ({ data: (await f()).data, stale: false }),
  die: (e: unknown) => { throw e; },
  env: {},
}));

describe('bracket command', () => {
  it('--json emits the nodes list', async () => {
    const program = new Command(); program.option('--json');
    bracketCmd(program);
    const chunks: string[] = [];
    const orig = process.stdout.write.bind(process.stdout);
    (process.stdout.write as unknown as (s: string) => boolean) = (s) => { chunks.push(s); return true; };
    try { await program.parseAsync(['node', 'wc26', 'bracket', '--json']); } finally { process.stdout.write = orig; }
    expect(JSON.parse(chunks.join('')).data[0]).toMatchObject({ stage: 'r16', home: { code: 'ARG' } });
  });
});
