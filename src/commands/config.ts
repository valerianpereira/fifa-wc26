import type { Command } from 'commander';
export function configCmd(p: Command): void {
  p.command('config').description('TODO').action(() => { throw new Error('not implemented'); });
}
