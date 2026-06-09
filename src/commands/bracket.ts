import type { Command } from 'commander';
export function bracketCmd(p: Command): void {
  p.command('bracket').description('TODO').action(() => { throw new Error('not implemented'); });
}
