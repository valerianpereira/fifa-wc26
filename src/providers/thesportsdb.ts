import { httpJson } from '../http/client.js';
import { WC26Error } from '../errors.js';
import {
  Provider, Fixture, FixtureQuery, LiveMatch, MatchDetail, GroupStanding,
  BracketNode, Team, Stage, Status,
} from './types.js';

const LEAGUE_ID = '4429';
const SEASON = '2026';

function base(key: string): string {
  return `https://www.thesportsdb.com/api/v1/json/${encodeURIComponent(key || '3')}`;
}

function mapStage(round: string | undefined): { stage: Stage; group?: string } {
  const r = (round ?? '').toLowerCase();
  if (/final/.test(r) && !/semi|quarter|third|3rd/.test(r)) return { stage: 'final' };
  if (/third|3rd/.test(r)) return { stage: 'third' };
  if (/semi/.test(r)) return { stage: 'sf' };
  if (/quarter/.test(r)) return { stage: 'qf' };
  if (/round of 16|r16|last 16/.test(r)) return { stage: 'r16' };
  const g = r.match(/group\s+([a-l])/);
  return { stage: 'group', group: g?.[1]?.toUpperCase() };
}

function teamCode(name: string | undefined | null, fallback?: string | null): string {
  const raw = (fallback ?? name ?? '?').toUpperCase().replace(/[^A-Z]/g, '');
  return raw.slice(0, 3) || '???';
}

interface TSDBEvent {
  idEvent: string;
  strEvent?: string;
  dateEvent?: string;
  strTime?: string;
  strTimestamp?: string;
  strHomeTeam?: string;
  strAwayTeam?: string;
  strHomeTeamShort?: string | null;
  strAwayTeamShort?: string | null;
  intHomeScore?: string | null;
  intAwayScore?: string | null;
  strVenue?: string | null;
  strStatus?: string | null;
  strPostponed?: string | null;
  strRound?: string | null;
  strGroup?: string | null;
}

function mapStatus(s: TSDBEvent): Status {
  const status = (s.strStatus ?? '').toLowerCase();
  if (s.strPostponed === 'yes' || status.includes('postp')) return 'postponed';
  if (status.includes('cancel')) return 'cancelled';
  if (/ft|finished|full[- ]time|match finished/.test(status)) return 'finished';
  if (/1h|2h|ht|live|in progress|playing/.test(status)) return 'live';
  if (s.intHomeScore != null && s.intAwayScore != null) return 'finished';
  return 'scheduled';
}

function fixtureFromTSDB(e: TSDBEvent): Fixture {
  const ts = e.strTimestamp ? new Date(e.strTimestamp) : new Date(`${e.dateEvent}T${e.strTime ?? '00:00:00'}Z`);
  const status = mapStatus(e);
  const hs = e.intHomeScore != null ? Number(e.intHomeScore) : NaN;
  const as = e.intAwayScore != null ? Number(e.intAwayScore) : NaN;
  const score = Number.isFinite(hs) && Number.isFinite(as) ? { home: hs, away: as } : undefined;
  const round = e.strRound ?? e.strGroup ?? '';
  const { stage, group: gFromRound } = mapStage(round);
  const group = gFromRound ?? (e.strGroup ? e.strGroup.replace(/^Group\s+/i, '').trim().toUpperCase().slice(0, 1) : undefined);
  return {
    id: e.idEvent,
    utcKickoff: ts.toISOString(),
    stage,
    group: group || undefined,
    home: { code: teamCode(e.strHomeTeam, e.strHomeTeamShort), name: e.strHomeTeam ?? '?' },
    away: { code: teamCode(e.strAwayTeam, e.strAwayTeamShort), name: e.strAwayTeam ?? '?' },
    venue: e.strVenue ?? '',
    status,
    score,
  };
}

export class TheSportsDbProvider implements Provider {
  name = 'thesportsdb';
  constructor(private apiKey: string = '3') {}
  isConfigured(): boolean { return true; }

  async fixtures(q: FixtureQuery): Promise<Fixture[]> {
    const data = await httpJson<{ events?: TSDBEvent[] | null }>(
      `${base(this.apiKey)}/eventsseason.php?id=${LEAGUE_ID}&s=${SEASON}`,
    );
    let out = (data.events ?? []).map(fixtureFromTSDB);
    if (q.from) out = out.filter((f) => f.utcKickoff.slice(0, 10) >= q.from!);
    if (q.to) out = out.filter((f) => f.utcKickoff.slice(0, 10) <= q.to!);
    if (q.teamCode) out = out.filter((f) => f.home.code === q.teamCode || f.away.code === q.teamCode);
    if (q.stage) out = out.filter((f) => f.stage === q.stage);
    return out;
  }

  async liveMatches(): Promise<LiveMatch[]> {
    const data = await httpJson<{ events?: TSDBEvent[] | null }>(
      `${base(this.apiKey)}/livescore.php?l=Soccer`,
    ).catch(() => ({ events: [] as TSDBEvent[] }));
    return (data.events ?? [])
      .filter((e) => (e as TSDBEvent & { idLeague?: string }).idLeague === LEAGUE_ID || (e.strEvent ?? '').includes('World Cup'))
      .map((e) => ({ ...fixtureFromTSDB(e), minute: 0, events: [] }));
  }

  async match(id: string): Promise<MatchDetail> {
    const data = await httpJson<{ events?: TSDBEvent[] | null }>(`${base(this.apiKey)}/lookupevent.php?id=${id}`);
    const e = data.events?.[0];
    if (!e) throw new WC26Error('NOT_FOUND', `match ${id} not found`);
    const f = fixtureFromTSDB(e);
    return { ...f, minute: 0, events: [], lineups: { home: [], away: [] }, stats: {} };
  }

  async standings(group?: string): Promise<GroupStanding[]> {
    const data = await httpJson<{
      table?: Array<{
        strTeam: string; strTeamBadge?: string; strTeamShort?: string | null;
        intPlayed?: string; intWin?: string; intDraw?: string; intLoss?: string;
        intGoalsFor?: string; intGoalsAgainst?: string; intGoalDifference?: string;
        intPoints?: string; strDescription?: string | null; strGroup?: string | null;
      }> | null;
    }>(`${base(this.apiKey)}/lookuptable.php?l=${LEAGUE_ID}&s=${SEASON}`);
    const groups = new Map<string, GroupStanding>();
    for (const row of data.table ?? []) {
      const label = (row.strGroup ?? '').replace(/^Group\s+/i, '').trim().toUpperCase().slice(0, 1) || '?';
      if (!groups.has(label)) groups.set(label, { group: label, rows: [] });
      groups.get(label)!.rows.push({
        team: { code: teamCode(row.strTeam, row.strTeamShort), name: row.strTeam },
        p: Number(row.intPlayed ?? 0),
        w: Number(row.intWin ?? 0),
        d: Number(row.intDraw ?? 0),
        l: Number(row.intLoss ?? 0),
        gf: Number(row.intGoalsFor ?? 0),
        ga: Number(row.intGoalsAgainst ?? 0),
        gd: Number(row.intGoalDifference ?? 0),
        pts: Number(row.intPoints ?? 0),
      });
    }
    const out = [...groups.values()].sort((a, b) => a.group.localeCompare(b.group));
    return group ? out.filter((g) => g.group === group.toUpperCase()) : out;
  }

  async knockoutBracket(): Promise<BracketNode[]> {
    const fixtures = await this.fixtures({});
    const stages: BracketNode['stage'][] = ['r16', 'qf', 'sf', 'third', 'final'];
    return fixtures
      .filter((f) => (stages as string[]).includes(f.stage))
      .map((f) => ({
        stage: f.stage as BracketNode['stage'],
        matchId: f.id,
        home: f.home,
        away: f.away,
        winner:
          f.status === 'finished' && f.score
            ? f.score.home > f.score.away ? f.home
            : f.score.away > f.score.home ? f.away
            : undefined
            : undefined,
      }));
  }

  async team(code: string): Promise<Team> {
    const data = await httpJson<{
      teams?: Array<{ idTeam: string; strTeam: string; strTeamShort?: string | null }> | null;
    }>(`${base(this.apiKey)}/search_all_teams.php?l=FIFA%20World%20Cup`).catch(() => ({ teams: [] }));
    const list = data.teams ?? [];
    const t = list.find((x) => teamCode(x.strTeam, x.strTeamShort) === code.toUpperCase());
    if (!t) throw new WC26Error('NOT_FOUND', `team ${code} not found`);
    const fixtures = await this.fixtures({ teamCode: code });
    return {
      code: teamCode(t.strTeam, t.strTeamShort),
      name: t.strTeam,
      squad: [],
      fixtures,
    };
  }
}
