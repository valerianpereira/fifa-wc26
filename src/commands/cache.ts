import type { Command } from 'commander';
import { env, die, type GlobalOpts } from './_shared.js';

export function cacheCmd(p: Command): void {
  const root = p.command('cache').description('Manage local cache');
  root.command('clear')
    .description('drop cached files')
    .option('--resource <name>', 'only this resource directory')
    .action(async (opts: { resource?: string }, cmd: Command) => {
      const g = cmd.optsWithGlobals() as GlobalOpts;
      try { await env.cache.clear(opts.resource); } catch (e) { die(e, g); }
    });
}
