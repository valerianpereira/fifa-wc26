import { httpJson } from '../http/client.js';
import { WC26Error } from '../errors.js';
import {
  Provider, Fixture, FixtureQuery, LiveMatch, MatchDetail,
  GroupStanding, BracketNode, Team, Stage, Status,
} from './types.js';

const BASE = 'https://api.football-data.org/v4';
const COMP = 'WC';

function mapStage(s: string): Stage {
  switch (s) {
    case 'GROUP_STAGE': return 'group';
    case 'LAST_16': return 'r16';
    case 'QUARTER_FINALS': return 'qf';
    case 'SEMI_FINALS': return 'sf';
    case 'THIRD_PLACE': return 'third';
    case 'FINAL': return 'final';
    default: return 'group';
  }
}

function mapStatus(s: string): Status {
  switch (s) {
    case 'SCHEDULED':
    case 'TIMED': return 'scheduled';
    case 'IN_PLAY':
    case 'PAUSED': return 'live';
    case 'FINISHED': return 'finished';
    case 'POSTPONED':
    case 'SUSPENDED': return 'postponed';
    case 'CANCELLED': return 'cancelled';
    default: return 'scheduled';
  }
}

interface FDMatch {
  id: number;
  utcDate: string;
  stage: string;
  group?: string | null;
  status: string;
  venue?: string;
  homeTeam: { tla: string; name: string };
  awayTeam: { tla: string; name: string };
  score: { fullTime: { home: number | null; away: number | null } };
  minute?: number;
}

function fixtureFromFD(m: FDMatch): Fixture {
  const score =
    m.score.fullTime.home != null && m.score.fullTime.away != null
      ? { home: m.score.fullTime.home, away: m.score.fullTime.away }
      : undefined;
  return {
    id: String(m.id),
    utcKickoff: new Date(m.utcDate).toISOString(),
    stage: mapStage(m.stage),
    group: m.group ? m.group.replace(/^GROUP_/, '') : undefined,
    home: { code: m.homeTeam.tla, name: m.homeTeam.name },
    away: { code: m.awayTeam.tla, name: m.awayTeam.name },
    venue: m.venue ?? '',
    status: mapStatus(m.status),
    score,
  };
}

export class FootballDataProvider implements Provider {
  name = 'football-data';
  constructor(private apiKey: string) {}
  isConfigured(): boolean { return this.apiKey.length > 0; }
  private headers() { return { 'X-Auth-Token': this.apiKey }; }

  async fixtures(q: FixtureQuery): Promise<Fixture[]> {
    const params = new URLSearchParams();
    if (q.from) params.set('dateFrom', q.from);
    if (q.to) params.set('dateTo', q.to);
    const url = `${BASE}/competitions/${COMP}/matches${params.toString() ? `?${params}` : ''}`;
    const data = await httpJson<{ matches: FDMatch[] }>(url, { headers: this.headers() });
    let out = data.matches.map(fixtureFromFD);
    if (q.teamCode) out = out.filter((f) => f.home.code === q.teamCode || f.away.code === q.teamCode);
    if (q.stage) out = out.filter((f) => f.stage === q.stage);
    return out;
  }

  async liveMatches(): Promise<LiveMatch[]> {
    const data = await httpJson<{ matches: FDMatch[] }>(
      `${BASE}/competitions/${COMP}/matches?status=LIVE,IN_PLAY,PAUSED`,
      { headers: this.headers() },
    );
    return data.matches.map((m) => ({ ...fixtureFromFD(m), minute: m.minute ?? 0, events: [] }));
  }

  async match(id: string): Promise<MatchDetail> {
    const data = await httpJson<{ match?: FDMatch }>(`${BASE}/matches/${id}`, { headers: this.headers() });
    if (!data.match) throw new WC26Error('NOT_FOUND', `match ${id} not found`);
    const m = data.match;
    return {
      ...fixtureFromFD(m), minute: m.minute ?? 0, events: [],
      lineups: { home: [], away: [] }, stats: {},
    };
  }

  async standings(): Promise<GroupStanding[]> {
    const data = await httpJson<{
      standings: Array<{ group: string | null; table: Array<{
        team: { tla: string; name: string };
        playedGames: number; won: number; draw: number; lost: number;
        goalsFor: number; goalsAgainst: number; goalDifference: number; points: number;
      }> }>;
    }>(`${BASE}/competitions/${COMP}/standings`, { headers: this.headers() });
    return data.standings
      .filter((s) => s.group)
      .map((s) => ({
        group: s.group!.replace(/^GROUP_/, ''),
        rows: s.table.map((r) => ({
          team: { code: r.team.tla, name: r.team.name },
          p: r.playedGames, w: r.won, d: r.draw, l: r.lost,
          gf: r.goalsFor, ga: r.goalsAgainst, gd: r.goalDifference, pts: r.points,
        })),
      }));
  }

  async knockoutBracket(): Promise<BracketNode[]> {
    const fixtures = await this.fixtures({});
    const ko: BracketNode['stage'][] = ['r16', 'qf', 'sf', 'third', 'final'];
    return fixtures
      .filter((f) => (ko as string[]).includes(f.stage))
      .map((f) => ({
        stage: f.stage as BracketNode['stage'],
        matchId: f.id,
        home: f.home,
        away: f.away,
        winner:
          f.status === 'finished' && f.score
            ? f.score.home > f.score.away
              ? f.home
              : f.score.away > f.score.home
                ? f.away
                : undefined
            : undefined,
      }));
  }

  async team(code: string): Promise<Team> {
    const data = await httpJson<{
      teams: Array<{ tla: string; name: string; squad: Array<{ name: string; position: string; shirtNumber?: number }> }>;
    }>(`${BASE}/competitions/${COMP}/teams`, { headers: this.headers() });
    const t = data.teams.find((x) => x.tla === code);
    if (!t) throw new WC26Error('NOT_FOUND', `team ${code} not found`);
    const fixtures = await this.fixtures({ teamCode: code });
    return {
      code: t.tla, name: t.name,
      squad: t.squad.map((p) => ({ name: p.name, position: p.position, number: p.shirtNumber })),
      fixtures,
    };
  }
}
