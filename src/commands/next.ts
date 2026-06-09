import type { Command } from 'commander';
export function nextCmd(p: Command): void {
  p.command('next').description('TODO').action(() => { throw new Error('not implemented'); });
}
