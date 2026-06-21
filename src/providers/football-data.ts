import { httpJson } from '../http/client.js';
import { WC26Error } from '../errors.js';
import { lookupWC26Venue } from '../data/wc26-venues.js';
import {
  Provider, Fixture, FixtureQuery, LiveMatch, MatchDetail, GroupStanding,
  BracketNode, Team, Stage, Status,
} from './types.js';

/**
 * Default URL of the bundled wc26-proxy Cloudflare Worker.
 * Replace this string before publishing to npm with your deployed Worker URL.
 * Power users can override at runtime via the `WC26_PROXY_URL` env var.
 */
const DEFAULT_PROXY_BASE = 'https://wc26-proxy.vercel.app';

function resolveBase(override?: string): string {
  return (override ?? process.env.WC26_PROXY_URL ?? DEFAULT_PROXY_BASE).replace(/\/+$/, '');
}

type FDStage =
  | 'GROUP_STAGE' | 'LAST_16' | 'QUARTER_FINALS' | 'SEMI_FINALS'
  | 'THIRD_PLACE' | 'FINAL' | 'PRELIMINARY_ROUND' | 'PLAYOFF_ROUND_1' | 'PLAYOFF_ROUND_2';

const STAGE_MAP: Record<string, Stage> = {
  GROUP_STAGE: 'group',
  LAST_16: 'r16',
  QUARTER_FINALS: 'qf',
  SEMI_FINALS: 'sf',
  THIRD_PLACE: 'third',
  FINAL: 'final',
};

function mapStage(s: string | undefined): Stage {
  return STAGE_MAP[s ?? ''] ?? 'group';
}

function mapStatus(s: string | undefined): Status {
  switch (s) {
    case 'LIVE':
    case 'IN_PLAY':
    case 'PAUSED':
      return 'live';
    case 'FINISHED':
    case 'AWARDED':
      return 'finished';
    case 'POSTPONED':
    case 'SUSPENDED':
      return 'postponed';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'scheduled';
  }
}

interface FDTeam {
  id?: number;
  name?: string;
  shortName?: string | null;
  tla?: string | null;
}

interface FDScoreSide { home: number | null; away: number | null }

interface FDScore {
  winner?: string | null;
  duration?: string;
  fullTime?: FDScoreSide;
  halfTime?: FDScoreSide;
  regularTime?: FDScoreSide;
  extraTime?: FDScoreSide;
  penalties?: FDScoreSide;
}

interface FDMatch {
  id: number;
  utcDate: string;
  status: string;
  matchday?: number | null;
  stage?: FDStage;
  group?: string | null;
  homeTeam: FDTeam;
  awayTeam: FDTeam;
  score?: FDScore;
  venue?: string | null;
}

function teamRef(t: FDTeam): { code: string; name: string } {
  const name = t.name ?? t.shortName ?? t.tla ?? '?';
  const code = (t.tla ?? name.slice(0, 3)).toUpperCase().slice(0, 3);
  return { code, name };
}

function fixtureFromMatch(m: FDMatch): Fixture {
  const status = mapStatus(m.status);
  const ft = m.score?.fullTime;
  const hs = ft?.home;
  const as = ft?.away;
  const score = hs != null && as != null && (status === 'live' || status === 'finished')
    ? {
        home: hs,
        away: as,
        homePens: m.score?.penalties?.home ?? undefined,
        awayPens: m.score?.penalties?.away ?? undefined,
      }
    : undefined;
  const group = m.group ? m.group.replace(/^GROUP[_\s]+/i, '').trim().toUpperCase().slice(0, 1) : undefined;
  const id = String(m.id);
  return {
    id,
    utcKickoff: new Date(m.utcDate).toISOString(),
    stage: mapStage(m.stage),
    group: group || undefined,
    home: teamRef(m.homeTeam),
    away: teamRef(m.awayTeam),
    venue: m.venue ?? lookupWC26Venue(id) ?? '',
    status,
    score,
  };
}

export class FootballDataProvider implements Provider {
  name = 'football-data';
  private base: string;

  constructor(proxyBase?: string) {
    this.base = resolveBase(proxyBase);
  }

  isConfigured(): boolean { return Boolean(this.base); }

  private url(path: string, qs?: URLSearchParams): string {
    const q = qs && [...qs].length ? `?${qs.toString()}` : '';
    return `${this.base}${path}${q}`;
  }

  private async matches(q: FixtureQuery = {}): Promise<FDMatch[]> {
    const params = new URLSearchParams();
    if (q.from) params.set('dateFrom', q.from);
    if (q.to) params.set('dateTo', q.to);
    const data = await httpJson<{ matches?: FDMatch[] }>(this.url('/competitions/WC/matches', params));
    return data.matches ?? [];
  }

  async fixtures(q: FixtureQuery): Promise<Fixture[]> {
    const raw = await this.matches({ from: q.from, to: q.to });
    let out = raw.map(fixtureFromMatch);
    if (q.teamCode) out = out.filter((f) => f.home.code === q.teamCode || f.away.code === q.teamCode);
    if (q.stage) out = out.filter((f) => f.stage === q.stage);
    return out;
  }

  async liveMatches(): Promise<LiveMatch[]> {
    const raw = await this.matches();
    return raw
      .map(fixtureFromMatch)
      .filter((f) => f.status === 'live')
      .map((f) => ({ ...f, minute: 0, events: [] }));
  }

  async match(id: string): Promise<MatchDetail> {
    const data = await httpJson<{
      id?: number; utcDate?: string; status?: string;
      homeTeam?: FDTeam; awayTeam?: FDTeam; score?: FDScore;
      venue?: string | null; stage?: FDStage; group?: string | null;
      referees?: Array<{ name?: string; role?: string }>;
    }>(this.url(`/matches/${id}`));
    if (!data.id || !data.utcDate || !data.homeTeam || !data.awayTeam || !data.status) {
      throw new WC26Error('NOT_FOUND', `match ${id} not found`);
    }
    const m: FDMatch = {
      id: data.id,
      utcDate: data.utcDate,
      status: data.status,
      homeTeam: data.homeTeam,
      awayTeam: data.awayTeam,
      score: data.score,
      venue: data.venue,
      stage: data.stage,
      group: data.group,
    };
    const f = fixtureFromMatch(m);
    const ref = data.referees?.find((r) => /referee/i.test(r.role ?? ''))?.name;
    return {
      ...f,
      minute: 0,
      events: [],
      lineups: { home: [], away: [] },
      stats: {},
      referee: ref,
    };
  }

  async standings(group?: string): Promise<GroupStanding[]> {
    const data = await httpJson<{
      standings?: Array<{
        group?: string | null;
        type?: string;
        table?: Array<{
          position: number;
          team: FDTeam;
          playedGames: number;
          won: number;
          draw: number;
          lost: number;
          points: number;
          goalsFor: number;
          goalsAgainst: number;
          goalDifference: number;
        }>;
      }>;
    }>(this.url('/competitions/WC/standings'));
    const out: GroupStanding[] = [];
    for (const s of data.standings ?? []) {
      if (s.type && s.type !== 'TOTAL') continue;
      const label = (s.group ?? '').replace(/^GROUP_/i, '').trim().toUpperCase().slice(0, 1);
      if (!label) continue;
      out.push({
        group: label,
        rows: (s.table ?? []).map((r) => ({
          team: teamRef(r.team),
          p: r.playedGames,
          w: r.won,
          d: r.draw,
          l: r.lost,
          gf: r.goalsFor,
          ga: r.goalsAgainst,
          gd: r.goalDifference,
          pts: r.points,
        })),
      });
    }
    out.sort((a, b) => a.group.localeCompare(b.group));
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
      teams?: Array<{ id: number; name: string; tla?: string | null; shortName?: string | null; coach?: { name?: string } }>;
    }>(this.url('/competitions/WC/teams'));
    const list = data.teams ?? [];
    const match = list.find((t) => (t.tla ?? '').toUpperCase() === code.toUpperCase());
    if (!match) throw new WC26Error('NOT_FOUND', `team ${code} not found`);
    let squad: Team['squad'] = [];
    let coach: string | undefined = match.coach?.name;
    try {
      const t = await httpJson<{
        squad?: Array<{ name?: string; position?: string; shirtNumber?: number | null }>;
        coach?: { name?: string };
      }>(this.url(`/teams/${match.id}`));
      squad = (t.squad ?? []).map((p) => ({
        name: p.name ?? '?',
        position: p.position ?? '',
        number: p.shirtNumber ?? undefined,
      }));
      coach = t.coach?.name ?? coach;
    } catch {
      squad = [];
    }
    const fixtures = await this.fixtures({ teamCode: code });
    return {
      code: (match.tla ?? code).toUpperCase(),
      name: match.name,
      coach,
      squad,
      fixtures,
    };
  }
}
