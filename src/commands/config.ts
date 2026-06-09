import type { Command } from 'commander';
import { env, die, type GlobalOpts } from './_shared.js';

export function configCmd(p: Command): void {
  const root = p.command('config').description('Get/set config values');

  root.command('set <key> [args...]')
    .description('set favorite <code> | apiKey <provider> <key> | providers <a,b>')
    .action(async (key: string, args: string[], _opts, cmd: Command) => {
      const g = cmd.optsWithGlobals() as GlobalOpts;
      try {
        if (key === 'favorite') {
          if (!args[0]) throw new Error('favorite requires a team code');
          await env.config.set('favoriteTeam', args[0]);
        } else if (key === 'apiKey') {
          if (!args[0] || !args[1]) throw new Error('apiKey requires <provider> <key>');
          await env.config.setApiKey(args[0], args[1]);
        } else if (key === 'providers') {
          if (!args[0]) throw new Error('providers requires a comma-separated list');
          await env.config.set('providers', args[0].split(','));
        } else throw new Error(`unknown key: ${key}`);
      } catch (e) { die(e, g); }
    });

  root.command('get <key> [args...]')
    .description('get a config value')
    .action(async (key: string, args: string[], _opts, cmd: Command) => {
      const g = cmd.optsWithGlobals() as GlobalOpts;
      try {
        const cfg = await env.config.load();
        if (key === 'favorite') process.stdout.write((cfg.favoriteTeam ?? '') + '\n');
        else if (key === 'apiKey') {
          if (!args[0]) throw new Error('apiKey requires <provider>');
          process.stdout.write(((await env.config.apiKey(args[0])) ?? '') + '\n');
        } else if (key === 'providers') process.stdout.write(cfg.providers.join(',') + '\n');
        else throw new Error(`unknown key: ${key}`);
      } catch (e) { die(e, g); }
    });
}
