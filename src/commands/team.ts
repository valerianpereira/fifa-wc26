import type { Command } from 'commander';
export function teamCmd(p: Command): void {
  p.command('team').description('TODO').action(() => { throw new Error('not implemented'); });
}
