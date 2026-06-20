import type { Command } from 'commander';
import { buildRegistry, runCached, die, type GlobalOpts } from './_shared.js';
import { renderJson } from '../render/json.js';
import { renderFixturesPlain } from '../render/plain.js';
import { renderFixturesPretty } from '../render/pretty.js';
import type { Fixture } from '../providers/types.js';

export function nextCmd(p: Command): void {
  p.command('next')
    .description('Show upcoming matches')
    .option('--team <code>', 'filter by team')
    .option('-n, --count <n>', 'number of matches', '5')
    .action(async (_opts, cmd: Command) => {
      const g = (cmd as Command).optsWithGlobals() as GlobalOpts & { team?: string; count?: string };
      const n = Math.max(1, parseInt(g.count ?? '5', 10));
      try {
        const reg = await buildRegistry(g);
        const key = `fixtures/${g.team ? `team-${g.team}` : 'all'}`;
        const { data, stale, reason } = await runCached<Fixture[]>(
          key, 6 * 3600,
          async () => {
            let provider = '';
            const data = await reg.call(async (p) => { provider = p.name; return p.fixtures({ teamCode: g.team }); });
            return { data, provider };
          },
          g,
        );
        const now = Date.now();
        const out = data
          .filter((f) => f.status === 'scheduled' && new Date(f.utcKickoff).getTime() > now)
          .sort((a, b) => a.utcKickoff.localeCompare(b.utcKickoff))
          .slice(0, n);
        if (g.json) process.stdout.write(renderJson(out, { stale, reason }) + '\n');
        else if (g.plain) process.stdout.write(renderFixturesPlain(out));
        else { if (stale) process.stdout.write(`[STALE${reason ? ` ${reason}` : ''}]\n`); process.stdout.write(renderFixturesPretty(out, 'no upcoming matches') + '\n'); }
      } catch (e) { die(e, g); }
    });
}
