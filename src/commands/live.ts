import type { Command } from 'commander';
import { buildRegistry, runCached, die, env, type GlobalOpts } from './_shared.js';
import { renderJson } from '../render/json.js';
import { renderLivePlain } from '../render/plain.js';
import { renderLivePretty } from '../render/pretty.js';
import type { LiveMatch, Fixture } from '../providers/types.js';

export function liveCmd(p: Command): void {
  p.command('live')
    .description('Show live matches')
    .option('--watch', 'interactive dashboard')
    .option('--interval <sec>', 'refresh interval in seconds', '15')
    .action(async (_opts, cmd: Command) => {
      const g = cmd.optsWithGlobals() as GlobalOpts & { watch?: boolean; interval?: string };
      try {
        if (g.watch) {
          const { render } = await import('ink');
          const React = (await import('react')).default;
          const { Dashboard } = await import('../render/live-dashboard.js');

          const cfg = await env.config.load();
          const interval = Math.max(10, parseInt(g.interval ?? String(cfg.defaults.watchIntervalSec), 10)) * 1000;
          const fav = cfg.favoriteTeam;
          let favoriteOnly = false;

          const reg = await buildRegistry(g);

          let state: { live: LiveMatch[]; upcoming: Fixture[]; stale: boolean; reason?: string } =
            { live: [], upcoming: [], stale: false };

          async function refresh(): Promise<void> {
            try {
              const { data: live, stale, reason } = await runCached<LiveMatch[]>(
                'live/all', 10,
                async () => { let provider = ''; const data = await reg.call(async (p) => { provider = p.name; return p.liveMatches(); }); return { data, provider }; },
                g,
              );
              const { data: fx } = await runCached<Fixture[]>(
                'fixtures/all', 6 * 3600,
                async () => { let provider = ''; const data = await reg.call(async (p) => { provider = p.name; return p.fixtures({}); }); return { data, provider };  },
                g,
              );
              const now = Date.now();
              const upcoming = fx
                .filter((f) => f.status === 'scheduled' && new Date(f.utcKickoff).getTime() > now)
                .sort((a, b) => a.utcKickoff.localeCompare(b.utcKickoff))
                .slice(0, 8);
              const filterFav = (m: { home: { code: string }; away: { code: string } }) =>
                !favoriteOnly || !fav || m.home.code === fav || m.away.code === fav;
              state = { live: live.filter(filterFav), upcoming: upcoming.filter(filterFav), stale, reason };
              app.rerender(React.createElement(Dashboard, { ...state, favoriteOnly }));
            } catch (e) { die(e, g); }
          }

          const app = render(React.createElement(Dashboard, { ...state, favoriteOnly }));
          await refresh();
          const timer = setInterval(refresh, interval);

          process.stdin.setRawMode?.(true);
          process.stdin.resume();
          process.stdin.on('data', (buf: Buffer) => {
            const k = buf.toString();
            if (k === 'q' || k === '') { clearInterval(timer); app.unmount(); process.exit(0); }
            if (k === 'r') void refresh();
            if (k === 't') { favoriteOnly = !favoriteOnly; void refresh(); }
          });
          return;
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
