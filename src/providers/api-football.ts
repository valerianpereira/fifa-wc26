import { httpJson } from '../http/client.js';
import { WC26Error } from '../errors.js';
import {
  Provider, Fixture, FixtureQuery, LiveMatch, MatchDetail, GroupStanding,
  BracketNode, Team, Stage, Status, MatchEvent,
} from './types.js';

const BASE = 'https://v3.football.api-sports.io';
const LEAGUE_ID = 1;
const SEASON = 2026;

function mapStage(round: string): Stage {
  const r = round.toLowerCase();
  if (r.includes('final') && !r.includes('semi') && !r.includes('quarter') && !r.includes('third')) return 'final';
  if (r.includes('third')) return 'third';
  if (r.includes('semi')) return 'sf';
  if (r.includes('quarter')) return 'qf';
  if (r.includes('round of 16') || r.includes('r16')) return 'r16';
  return 'group';
}

function mapStatus(short: string): Status {
  if (['1H', '2H', 'HT', 'ET', 'P', 'LIVE', 'BT'].includes(short)) return 'live';
  if (['FT', 'AET', 'PEN'].includes(short)) return 'finished';
  if (short === 'PST') return 'postponed';
  if (short === 'CANC' || short === 'ABD') return 'cancelled';
  return 'scheduled';
}

function mapEventType(t: string): MatchEvent['type'] {
  const x = t.toLowerCase();
  if (x === 'goal') return 'goal';
  if (x === 'card') return 'yellow';
  if (x === 'subst') return 'sub';
  if (x === 'var') return 'var';
  return 'goal';
}

interface AFFixture {
  fixture: { id: number; date: string; status: { short: string; elapsed?: number | null }; venue: { name?: string } };
  league: { round: string; season: number };
  teams: { home: { name: string; code?: string }; away: { name: string; code?: string } };
  goals: { home: number | null; away: number | null };
  events?: Array<{
    time: { elapsed: number };
    type: string;
    team: { name: string };
    player?: { name?: string };
    detail?: string;
  }>;
}

function fixtureFromAF(f: AFFixture): Fixture {
  const score =
    f.goals.home != null && f.goals.away != null ? { home: f.goals.home, away: f.goals.away } : undefined;
  return {
    id: String(f.fixture.id),
    utcKickoff: new Date(f.fixture.date).toISOString(),
    stage: mapStage(f.league.round),
    group: undefined,
    home: { code: f.teams.home.code ?? f.teams.home.name.slice(0, 3).toUpperCase(), name: f.teams.home.name },
    away: { code: f.teams.away.code ?? f.teams.away.name.slice(0, 3).toUpperCase(), name: f.teams.away.name },
    venue: f.fixture.venue.name ?? '',
    status: mapStatus(f.fixture.status.short),
    score,
  };
}

function liveFromAF(f: AFFixture): LiveMatch {
  const base = fixtureFromAF(f);
  const minute = f.fixture.status.elapsed ?? 0;
  const events: MatchEvent[] =
    f.events?.map((e) => ({
      minute: e.time.elapsed,
      type: mapEventType(e.type),
      team: e.team.name === f.teams.home.name ? 'home' : 'away',
      player: e.player?.name,
      detail: e.detail,
    })) ?? [];
  return { ...base, minute, events };
}

export class ApiFootballProvider implements Provider {
  name = 'api-football';
  constructor(private apiKey: string) {}
  isConfigured(): boolean { return this.apiKey.length > 0; }

  private headers() { return { 'x-apisports-key': this.apiKey }; }

  async fixtures(q: FixtureQuery): Promise<Fixture[]> {
    const params = new URLSearchParams({ league: String(LEAGUE_ID), season: String(SEASON) });
    if (q.from) params.set('from', q.from);
    if (q.to) params.set('to', q.to);
    if (q.teamCode) params.set('team', q.teamCode);
    const data = await httpJson<{ response: AFFixture[] }>(`${BASE}/fixtures?${params}`, { headers: this.headers() });
    return data.response.map(fixtureFromAF);
  }

  async liveMatches(): Promise<LiveMatch[]> {
    const params = new URLSearchParams({ league: String(LEAGUE_ID), live: 'all' });
    const data = await httpJson<{ response: AFFixture[] }>(`${BASE}/fixtures?${params}`, { headers: this.headers() });
    return data.response.map(liveFromAF);
  }

  async match(id: string): Promise<MatchDetail> {
    const params = new URLSearchParams({ id });
    const data = await httpJson<{ response: AFFixture[] }>(`${BASE}/fixtures?${params}`, { headers: this.headers() });
    const f = data.response[0];
    if (!f) throw new WC26Error('NOT_FOUND', `match ${id} not found`);
    return { ...liveFromAF(f), lineups: { home: [], away: [] }, stats: {} };
  }

  async standings(): Promise<GroupStanding[]> {
    const params = new URLSearchParams({ league: String(LEAGUE_ID), season: String(SEASON) });
    const data = await httpJson<{
      response: Array<{ league: { standings: Array<Array<{
        group: string;
        team: { name: string; code?: string };
        all: { played: number; win: number; draw: number; lose: number; goals: { for: number; against: number } };
        goalsDiff: number; points: number;
      }>> } }>;
    }>(`${BASE}/standings?${params}`, { headers: this.headers() });
    const groups = new Map<string, GroupStanding>();
    for (const block of data.response[0]?.league.standings ?? []) {
      for (const row of block) {
        const key = row.group.replace(/^Group\s*/i, '');
        if (!groups.has(key)) groups.set(key, { group: key, rows: [] });
        groups.get(key)!.rows.push({
          team: { code: row.team.code ?? row.team.name.slice(0, 3).toUpperCase(), name: row.team.name },
          p: row.all.played, w: row.all.win, d: row.all.draw, l: row.all.lose,
          gf: row.all.goals.for, ga: row.all.goals.against, gd: row.goalsDiff, pts: row.points,
        });
      }
    }
    return [...groups.values()].sort((a, b) => a.group.localeCompare(b.group));
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
            ? f.score.home > f.score.away
              ? f.home
              : f.score.away > f.score.home
                ? f.away
                : undefined
            : undefined,
      }));
  }

  async team(code: string): Promise<Team> {
    const params = new URLSearchParams({ league: String(LEAGUE_ID), season: String(SEASON), code });
    const data = await httpJson<{ response: Array<{ team: { name: string; code: string } }> }>(
      `${BASE}/teams?${params}`,
      { headers: this.headers() },
    );
    const t = data.response[0];
    if (!t) throw new WC26Error('NOT_FOUND', `team ${code} not found`);
    const fixtures = await this.fixtures({ teamCode: code });
    return { code: t.team.code, name: t.team.name, squad: [], fixtures };
  }
}
