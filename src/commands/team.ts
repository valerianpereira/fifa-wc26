import type { Command } from 'commander';
import { buildRegistry, runCached, die, type GlobalOpts } from './_shared.js';
import { renderJson } from '../render/json.js';
import { renderTeamPlain } from '../render/plain.js';
import { renderTeamPretty } from '../render/pretty.js';
import type { Team } from '../providers/types.js';

export function teamCmd(p: Command): void {
  p.command('team <code>')
    .description('Show team info, squad, and fixtures')
    .action(async (code: string, _opts, cmd: Command) => {
      const g = cmd.optsWithGlobals() as GlobalOpts;
      const upper = code.toUpperCase();
      try {
        const reg = await buildRegistry(g);
        const { data, stale, reason } = await runCached<Team>(
          `team/${upper}`, 24 * 3600,
          async () => {
            let provider = '';
            const data = await reg.call(async (p) => { provider = p.name; return p.team(upper); });
            return { data, provider };
          },
          g,
        );
        if (g.json) process.stdout.write(renderJson(data, { stale, reason }) + '\n');
        else if (g.plain) process.stdout.write(renderTeamPlain(data));
        else { if (stale) process.stdout.write(`[STALE${reason ? ` ${reason}` : ''}]\n`); process.stdout.write(renderTeamPretty(data) + '\n'); }
      } catch (e) { die(e, g); }
    });
}
