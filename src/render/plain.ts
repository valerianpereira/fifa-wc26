import type { Fixture, LiveMatch, GroupStanding, BracketNode, Team } from '../providers/types.js';

const scoreStr = (f: Fixture): string => (f.score ? `${f.score.home}-${f.score.away}` : '-');

export function renderFixturesPlain(items: Fixture[]): string {
  const lines = ['id\tkickoff\tstage\tgroup\thome\taway\tvenue\tstatus\tscore'];
  for (const f of items) {
    lines.push([f.id, f.utcKickoff, f.stage, f.group ?? '-', f.home.code, f.away.code, f.venue, f.status, scoreStr(f)].join('\t'));
  }
  return lines.join('\n') + '\n';
}

export function renderLivePlain(items: LiveMatch[]): string {
  const lines = ['id\tminute\thome\taway\tscore\tstatus'];
  for (const m of items) {
    lines.push([m.id, m.minute, m.home.code, m.away.code, scoreStr(m), m.status].join('\t'));
  }
  return lines.join('\n') + '\n';
}

export function renderStandingsPlain(groups: GroupStanding[]): string {
  const lines = ['group\tteam\tp\tw\td\tl\tgf\tga\tgd\tpts'];
  for (const g of groups) {
    for (const r of g.rows) {
      lines.push([g.group, r.team.code, r.p, r.w, r.d, r.l, r.gf, r.ga, r.gd, r.pts].join('\t'));
    }
  }
  return lines.join('\n') + '\n';
}

export function renderBracketPlain(nodes: BracketNode[]): string {
  const lines = ['stage\thome\taway\twinner'];
  for (const n of nodes) {
    lines.push([n.stage, n.home?.code ?? '?', n.away?.code ?? '?', n.winner?.code ?? '-'].join('\t'));
  }
  return lines.join('\n') + '\n';
}

export function renderTeamPlain(t: Team): string {
  return [
    `code\tname\tgroup`,
    `${t.code}\t${t.name}\t${t.group ?? '-'}`,
  ].join('\n') + '\n';
}
