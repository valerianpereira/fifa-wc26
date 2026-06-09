import type { Command } from 'commander';
export function matchCmd(p: Command): void {
  p.command('match').description('TODO').action(() => { throw new Error('not implemented'); });
}
