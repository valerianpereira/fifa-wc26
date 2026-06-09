import type { Command } from 'commander';
import { buildRegistry, runCached, die, type GlobalOpts } from './_shared.js';
import { renderJson } from '../render/json.js';
import { renderFixturesPlain } from '../render/plain.js';
import { renderFixturesPretty } from '../render/pretty.js';
import type { Fixture, FixtureQuery } from '../providers/types.js';

export function fixturesCmd(p: Command): void {
  p.command('fixtures')
    .description('List World Cup fixtures')
    .option('--team <code>', 'filter by FIFA 3-letter team code')
    .option('--from <date>', 'ISO date (or "today")')
    .option('--to <date>', 'ISO date')
    .option('--stage <s>', 'group|r16|qf|sf|third|final')
    .action(async (_opts, cmd: Command) => {
      const g = cmd.optsWithGlobals() as GlobalOpts & { team?: string; from?: string; to?: string; stage?: string };
      try {
        const q: FixtureQuery = {
          teamCode: g.team,
          from: g.from === 'today' ? new Date().toISOString().slice(0, 10) : g.from,
          to: g.to,
          stage: g.stage as FixtureQuery['stage'],
        };
        const key = `fixtures/${g.team ? `team-${g.team}` : 'all'}`;
        const reg = await buildRegistry(g);
        const { data, stale, reason } = await runCached<Fixture[]>(
          key, 6 * 3600,
          async () => {
            let provider = '';
            const data = await reg.call(async (p) => { provider = p.name; return p.fixtures(q); });
            return { data, provider };
          },
          g,
        );
        const filtered = data.filter((f) =>
          (!q.stage || f.stage === q.stage) &&
          (!q.teamCode || f.home.code === q.teamCode || f.away.code === q.teamCode),
        );
        if (g.json) process.stdout.write(renderJson(filtered, { stale, reason }) + '\n');
        else if (g.plain) process.stdout.write(renderFixturesPlain(filtered));
        else {
          if (stale) process.stdout.write(`[STALE${reason ? ` ${reason}` : ''}]\n`);
          process.stdout.write(renderFixturesPretty(filtered) + '\n');
        }
      } catch (e) { die(e, g); }
    });
}
