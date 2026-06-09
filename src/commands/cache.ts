import type { Command } from 'commander';
export function cacheCmd(p: Command): void {
  p.command('cache').description('TODO').action(() => { throw new Error('not implemented'); });
}
