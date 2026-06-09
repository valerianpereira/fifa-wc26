import { describe, it, expect, vi } from 'vitest';
import { Command } from 'commander';
import { fixturesCmd } from '../../src/commands/fixtures.js';
import type { Fixture } from '../../src/providers/types.js';

const fx: Fixture = {
  id: '1', utcKickoff: '2026-06-15T18:00:00.000Z', stage: 'group', group: 'A',
  home: { code: 'MEX', name: 'Mexico' }, away: { code: 'CAN', name: 'Canada' },
  venue: 'Azteca', status: 'scheduled',
};

vi.mock('../../src/commands/_shared.js', () => ({
  buildRegistry: async () => ({ call: async (fn: (p: { fixtures: () => Promise<Fixture[]> }) => Promise<Fixture[]>) => fn({ fixtures: async () => [fx] }) }),
  runCached: async (_k: string, _t: number, f: () => Promise<{ data: Fixture[]; provider: string }>) => ({ data: (await f()).data, stale: false }),
  die: (e: unknown) => { throw e; },
  env: {},
}));

async function run(argv: string[]): Promise<string> {
  const program = new Command();
  program.option('--json').option('--plain');
  fixturesCmd(program);
  const chunks: string[] = [];
  const orig = process.stdout.write.bind(process.stdout);
  (process.stdout.write as unknown as (s: string) => boolean) = (s: string) => { chunks.push(s); return true; };
  try { await program.parseAsync(['node', 'wc26', ...argv]); } finally { process.stdout.write = orig; }
  return chunks.join('');
}

describe('fixtures command', () => {
  it('--json emits stale=false payload', async () => {
    const out = await run(['fixtures', '--json']);
    const parsed = JSON.parse(out);
    expect(parsed.stale).toBe(false);
    expect(parsed.data[0].id).toBe('1');
  });

  it('--plain emits TSV header', async () => {
    const out = await run(['fixtures', '--plain']);
    expect(out.split('\n')[0]).toBe('id\tkickoff\tstage\tgroup\thome\taway\tvenue\tstatus\tscore');
  });
});
