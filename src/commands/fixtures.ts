import type { Command } from 'commander';
export function fixturesCmd(p: Command): void {
  p.command('fixtures').description('TODO').action(() => { throw new Error('not implemented'); });
}
