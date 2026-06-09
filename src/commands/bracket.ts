import type { Command } from 'commander';
import { buildRegistry, runCached, die, type GlobalOpts } from './_shared.js';
import { renderJson } from '../render/json.js';
import { renderBracketPlain } from '../render/plain.js';
import { renderBracketAscii } from '../render/bracket.js';
import type { BracketNode } from '../providers/types.js';

export function bracketCmd(p: Command): void {
  p.command('bracket')
    .description('Show knockout bracket')
    .option('--from <stage>', 'r16|qf|sf|final')
    .action(async (_opts, cmd: Command) => {
      const g = cmd.optsWithGlobals() as GlobalOpts & { from?: string };
      try {
        const reg = await buildRegistry(g);
        const { data, stale, reason } = await runCached<BracketNode[]>(
          'bracket/all', 3600,
          async () => {
            let provider = '';
            const data = await reg.call(async (p) => { provider = p.name; return p.knockoutBracket(); });
            return { data, provider };
          },
          g,
        );
        const order: BracketNode['stage'][] = ['r16', 'qf', 'sf', 'final', 'third'];
        const fromIdx = g.from ? order.indexOf(g.from as BracketNode['stage']) : 0;
        const filtered = fromIdx <= 0 ? data : data.filter((n) => order.indexOf(n.stage) >= fromIdx);
        if (g.json) process.stdout.write(renderJson(filtered, { stale, reason }) + '\n');
        else if (g.plain) process.stdout.write(renderBracketPlain(filtered));
        else { if (stale) process.stdout.write(`[STALE${reason ? ` ${reason}` : ''}]\n`); process.stdout.write(renderBracketAscii(filtered) + '\n'); }
      } catch (e) { die(e, g); }
    });
}
