import type { Command } from 'commander';
import { buildRegistry, runCached, die, type GlobalOpts } from './_shared.js';
import { renderJson } from '../render/json.js';
import { renderStandingsPlain } from '../render/plain.js';
import { renderStandingsPretty } from '../render/pretty.js';
import type { GroupStanding } from '../providers/types.js';

export function groupsCmd(p: Command): void {
  p.command('groups [group]')
    .description('Show group standings')
    .action(async (group: string | undefined, _opts, cmd: Command) => {
      const g = cmd.optsWithGlobals() as GlobalOpts;
      try {
        const reg = await buildRegistry(g);
        const { data, stale, reason } = await runCached<GroupStanding[]>(
          group ? `standings/group-${group.toUpperCase()}` : 'standings/all', 3600,
          async () => {
            let provider = '';
            const data = await reg.call(async (p) => { provider = p.name; return p.standings(); });
            return { data, provider };
          },
          g,
        );
        const filtered = group ? data.filter((x) => x.group === group.toUpperCase()) : data;
        if (g.json) process.stdout.write(renderJson(filtered, { stale, reason }) + '\n');
        else if (g.plain) process.stdout.write(renderStandingsPlain(filtered));
        else { if (stale) process.stdout.write(`[STALE${reason ? ` ${reason}` : ''}]\n`); process.stdout.write(renderStandingsPretty(filtered) + '\n'); }
      } catch (e) { die(e, g); }
    });
}
