import Table from 'cli-table3';
import chalk from 'chalk';
import type { Fixture, LiveMatch, GroupStanding, Team } from '../providers/types.js';

const stageLabel = (s: string): string => ({
  group: 'Group', r16: 'R16', qf: 'QF', sf: 'SF', third: '3rd', final: 'Final',
}[s] ?? s);

const colorStatus = (s: Fixture['status']): string => {
  if (s === 'live') return chalk.green(s);
  if (s === 'finished') return chalk.gray(s);
  if (s === 'cancelled' || s === 'postponed') return chalk.red(s);
  return chalk.cyan(s);
};

const scoreStr = (f: Fixture): string => (f.score ? `${f.score.home}-${f.score.away}` : '–');

export function renderFixturesPretty(fixtures: Fixture[], emptyMessage = 'no matches'): string {
  if (fixtures.length === 0) return chalk.dim(emptyMessage);
  const t = new Table({
    head: ['Kickoff (UTC)', 'Stage', 'Home', 'Away', 'Venue', 'Score', 'Status'],
    style: { head: ['bold'] },
  });
  for (const f of fixtures) {
    t.push([
      f.utcKickoff.replace('T', ' ').replace('.000Z', ''),
      `${stageLabel(f.stage)}${f.group ? ' ' + f.group : ''}`,
      `${f.home.code} ${chalk.dim(f.home.name)}`,
      `${f.away.code} ${chalk.dim(f.away.name)}`,
      f.venue,
      scoreStr(f),
      colorStatus(f.status),
    ]);
  }
  return t.toString();
}

export function renderLivePretty(items: LiveMatch[]): string {
  if (items.length === 0) return chalk.dim('no live matches');
  const t = new Table({ head: ['Min', 'Home', 'Score', 'Away', 'Stage'], style: { head: ['bold'] } });
  for (const m of items) {
    t.push([
      chalk.green(`${m.minute}'`),
      `${m.home.code} ${chalk.dim(m.home.name)}`,
      scoreStr(m),
      `${m.away.code} ${chalk.dim(m.away.name)}`,
      stageLabel(m.stage),
    ]);
  }
  return t.toString();
}

export function renderStandingsPretty(groups: GroupStanding[]): string {
  return groups.map((g) => {
    const t = new Table({
      head: ['Team', 'P', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'Pts'],
      style: { head: ['bold'] },
    });
    for (const r of g.rows) {
      t.push([`${r.team.code} ${chalk.dim(r.team.name)}`, r.p, r.w, r.d, r.l, r.gf, r.ga, r.gd, chalk.bold(String(r.pts))]);
    }
    return chalk.bold(`Group ${g.group}`) + '\n' + t.toString();
  }).join('\n\n');
}

export function renderTeamPretty(t: Team): string {
  const head = `${chalk.bold(t.name)} (${t.code})${t.group ? ` — Group ${t.group}` : ''}${t.coach ? ` — ${t.coach}` : ''}`;
  const sq = new Table({ head: ['#', 'Name', 'Pos', 'Club'], style: { head: ['bold'] } });
  for (const p of t.squad) sq.push([p.number ?? '', p.name, p.position, p.club ?? '']);
  const fx = renderFixturesPretty(t.fixtures);
  return [head, sq.toString(), chalk.bold('Fixtures'), fx].join('\n');
}
