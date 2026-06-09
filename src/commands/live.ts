import type { Command } from 'commander';
import { buildRegistry, runCached, die, type GlobalOpts } from './_shared.js';
import { renderJson } from '../render/json.js';
import { renderLivePlain } from '../render/plain.js';
import { renderLivePretty } from '../render/pretty.js';
import type { LiveMatch } from '../providers/types.js';

export function liveCmd(p: Command): void {
  p.command('live')
    .description('Show live matches')
    .option('--watch', 'interactive dashboard (added later)')
    .option('--interval <sec>', 'refresh interval in seconds', '15')
    .action(async (_opts, cmd: Command) => {
      const g = (cmd as Command).optsWithGlobals() as GlobalOpts & { watch?: boolean; interval?: string };
      try {
        if (g.watch) {
          process.stderr.write('--watch is enabled in a later task\n');
          process.exit(1);
        }
        const reg = await buildRegistry(g);
        const { data, stale, reason } = await runCached<LiveMatch[]>(
          'live/all', 10,
          async () => {
            let provider = '';
            const data = await reg.call(async (p) => { provider = p.name; return p.liveMatches(); });
            return { data, provider };
          },
          g,
        );
        if (g.json) process.stdout.write(renderJson(data, { stale, reason }) + '\n');
        else if (g.plain) process.stdout.write(renderLivePlain(data));
        else { if (stale) process.stdout.write(`[STALE${reason ? ` ${reason}` : ''}]\n`); process.stdout.write(renderLivePretty(data) + '\n'); }
      } catch (e) { die(e, g); }
    });
}
