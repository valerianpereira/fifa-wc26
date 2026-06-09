import { describe, it, expect, vi } from 'vitest';
import { Command } from 'commander';
import { teamCmd } from '../../src/commands/team.js';
import type { Team } from '../../src/providers/types.js';

const t: Team = { code: 'ARG', name: 'Argentina', group: 'C', squad: [], fixtures: [] };

vi.mock('../../src/commands/_shared.js', () => ({
  buildRegistry: async () => ({ call: async (fn: (p: { team: (c: string) => Promise<Team> }) => Promise<Team>) => fn({ team: async () => t }) }),
  runCached: async (_k: string, _t: number, f: () => Promise<{ data: Team; provider: string }>) => ({ data: (await f()).data, stale: false }),
  die: (e: unknown) => { throw e; },
  env: {},
}));

describe('team command', () => {
  it('--json returns the team object', async () => {
    const program = new Command(); program.option('--json');
    teamCmd(program);
    const chunks: string[] = [];
    const orig = process.stdout.write.bind(process.stdout);
    (process.stdout.write as unknown as (s: string) => boolean) = (s) => { chunks.push(s); return true; };
    try { await program.parseAsync(['node', 'wc26', 'team', 'ARG', '--json']); } finally { process.stdout.write = orig; }
    expect(JSON.parse(chunks.join('')).data.code).toBe('ARG');
  });
});
