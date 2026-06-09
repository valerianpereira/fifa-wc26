import type { Command } from 'commander';
import { buildRegistry, runCached, die, type GlobalOpts } from './_shared.js';
import { renderJson } from '../render/json.js';
import type { MatchDetail } from '../providers/types.js';

function renderMatchPretty(m: MatchDetail): string {
  const head = `[${m.stage.toUpperCase()}${m.group ? ' ' + m.group : ''}] ${m.home.name} vs ${m.away.name}  ${m.score ? `${m.score.home}-${m.score.away}` : '–'}  ${m.status === 'live' ? `${m.minute}'` : m.status}`;
  const events = m.events.map((e) => `  ${e.minute}'  ${e.type.padEnd(6)}  ${e.team.padEnd(4)}  ${e.player ?? ''}`).join('\n');
  return [head, m.venue, '', 'Events:', events || '  (none)'].join('\n');
}

function renderMatchPlain(m: MatchDetail): string {
  const head = `match\t${m.id}\t${m.home.code}\t${m.away.code}\t${m.score ? `${m.score.home}-${m.score.away}` : '-'}\t${m.status}\t${m.minute}`;
  const events = m.events.map((e) => `event\t${e.minute}\t${e.type}\t${e.team}\t${e.player ?? '-'}`).join('\n');
  return events ? `${head}\n${events}\n` : `${head}\n`;
}

export function matchCmd(p: Command): void {
  p.command('match <id>')
    .description('Show match detail')
    .action(async (id: string, _opts, cmd: Command) => {
      const g = cmd.optsWithGlobals() as GlobalOpts;
      try {
        const reg = await buildRegistry(g);
        const { data, stale, reason } = await runCached<MatchDetail>(
          `match/${id}`, 10,
          async () => {
            let provider = '';
            const data = await reg.call(async (p) => { provider = p.name; return p.match(id); });
            return { data, provider };
          },
          g,
        );
        if (g.json) process.stdout.write(renderJson(data, { stale, reason }) + '\n');
        else if (g.plain) process.stdout.write(renderMatchPlain(data));
        else { if (stale) process.stdout.write(`[STALE${reason ? ` ${reason}` : ''}]\n`); process.stdout.write(renderMatchPretty(data) + '\n'); }
      } catch (e) { die(e, g); }
    });
}
