import type { Command } from 'commander';
export function groupsCmd(p: Command): void {
  p.command('groups').description('TODO').action(() => { throw new Error('not implemented'); });
}
