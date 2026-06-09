import type { Command } from 'commander';
export function liveCmd(p: Command): void {
  p.command('live').description('TODO').action(() => { throw new Error('not implemented'); });
}
