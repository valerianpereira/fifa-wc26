import { httpJson } from '../http/client.js';
import { WC26Error } from '../errors.js';
import {
  Provider, Fixture, FixtureQuery, LiveMatch, MatchDetail, GroupStanding,
  BracketNode, Team, Stage, Status, MatchEvent,
} from './types.js';

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.worldcup';
const STANDINGS_BASE = 'https://site.api.espn.com/apis/v2/sports/soccer/fifa.worldcup';
const SEASON = 2026;

function mapStage(headline: string | undefined, typeName: string | undefined): { stage: Stage; group?: string } {
  const text = `${headline ?? ''} ${typeName ?? ''}`.toLowerCase();
  if (/third[- ]place|3rd[- ]place/.test(text)) return { stage: 'third' };
  if (/\bfinal\b/.test(text) && !/semi|quarter|third|3rd/.test(text)) return { stage: 'final' };
  if (/semi/.test(text)) return { stage: 'sf' };
  if (/quarter|qf\b/.test(text)) return { stage: 'qf' };
  if (/round of 16|r16|last 16/.test(text)) return { stage: 'r16' };
  const g = text.match(/group\s+([a-l])\b/i);
  return { stage: 'group', group: g?.[1]?.toUpperCase() };
}

function mapStatus(name: string | undefined, state: string | undefined): Status {
  if (name === 'STATUS_POSTPONED') return 'postponed';
  if (name === 'STATUS_CANCELED' || name === 'STATUS_FORFEIT') return 'cancelled';
  if (state === 'in') return 'live';
  if (state === 'post') return 'finished';
  return 'scheduled';
}

interface ESPNCompetitor {
  id: string;
  homeAway: 'home' | 'away';
  score?: string;
  winner?: boolean;
  team: { id: string; abbreviation?: string; displayName: string; name?: string };
}

interface ESPNDetail {
  type?: { id?: string; text?: string };
  clock?: { displayValue?: string };
  athletesInvolved?: Array<{ displayName?: string }>;
  team?: { id?: string };
  scoringPlay?: boolean;
  penaltyKick?: boolean;
  ownGoal?: boolean;
  redCard?: boolean;
  yellowCard?: boolean;
  text?: string;
}

interface ESPNStatus {
  type?: { name?: string; state?: string; completed?: boolean; description?: string };
  displayClock?: string;
  period?: number;
}

interface ESPNCompetition {
  id: string;
  date: string;
  venue?: { fullName?: string };
  status?: ESPNStatus;
  notes?: Array<{ type?: string; headline?: string }>;
  competitors: ESPNCompetitor[];
  details?: ESPNDetail[];
}

interface ESPNEvent {
  id: string;
  date: string;
  name?: string;
  status?: ESPNStatus;
  competitions: ESPNCompetition[];
}

function clockMinute(displayClock?: string, period?: number): number {
  if (!displayClock) return 0;
  const m = displayClock.match(/^(\d+)/);
  const base = m ? Number(m[1]) : 0;
  if (period === 2) return Math.max(base, 45);
  return base;
}

function teamRef(c: ESPNCompetitor): { code: string; name: string } {
  const name = c.team.displayName ?? c.team.name ?? c.team.abbreviation ?? '?';
  const code = (c.team.abbreviation ?? name.slice(0, 3)).toUpperCase().slice(0, 3);
  return { code, name };
}

function fixtureFromEvent(ev: ESPNEvent): Fixture {
  const comp = ev.competitions[0];
  if (!comp) throw new WC26Error('PROVIDER_UNREACHABLE', `event ${ev.id} has no competition`);
  const home = comp.competitors.find((c) => c.homeAway === 'home') ?? comp.competitors[0];
  const away = comp.competitors.find((c) => c.homeAway === 'away') ?? comp.competitors[1];
  if (!home || !away) throw new WC26Error('PROVIDER_UNREACHABLE', `event ${ev.id} missing competitors`);
  const status = mapStatus(comp.status?.type?.name ?? ev.status?.type?.name, comp.status?.type?.state ?? ev.status?.type?.state);
  const note = comp.notes?.[0]?.headline;
  const { stage, group } = mapStage(note, comp.status?.type?.description);
  const hs = Number(home.score);
  const as = Number(away.score);
  const score = Number.isFinite(hs) && Number.isFinite(as) && (status === 'live' || status === 'finished')
    ? { home: hs, away: as }
    : undefined;
  return {
    id: ev.id,
    utcKickoff: new Date(ev.date).toISOString(),
    stage,
    group,
    home: teamRef(home),
    away: teamRef(away),
    venue: comp.venue?.fullName ?? '',
    status,
    score,
  };
}

function eventToLive(ev: ESPNEvent): LiveMatch {
  const base = fixtureFromEvent(ev);
  const comp = ev.competitions[0]!;
  const minute = clockMinute(comp.status?.displayClock, comp.status?.period);
  const homeId = comp.competitors.find((c) => c.homeAway === 'home')?.team.id;
  const events: MatchEvent[] = (comp.details ?? []).map((d) => {
    const min = Number((d.clock?.displayValue ?? '0').match(/\d+/)?.[0] ?? 0);
    let type: MatchEvent['type'] = 'var';
    if (d.scoringPlay) type = d.ownGoal ? 'own-goal' : d.penaltyKick ? 'penalty' : 'goal';
    else if (d.redCard) type = 'red';
    else if (d.yellowCard) type = 'yellow';
    else if ((d.type?.text ?? '').toLowerCase().includes('substitution')) type = 'sub';
    return {
      minute: min,
      type,
      team: d.team?.id === homeId ? 'home' : 'away',
      player: d.athletesInvolved?.[0]?.displayName,
      detail: d.text ?? d.type?.text,
    };
  });
  return { ...base, minute, events };
}

function fmtDate(d: string): string {
  return d.replace(/-/g, '');
}

export class EspnProvider implements Provider {
  name = 'espn';
  isConfigured(): boolean { return true; }

  private async scoreboard(dates?: string): Promise<ESPNEvent[]> {
    const qs = dates ? `?dates=${dates}` : `?dates=${SEASON}`;
    const data = await httpJson<{ events?: ESPNEvent[] }>(`${BASE}/scoreboard${qs}`);
    return data.events ?? [];
  }

  async fixtures(q: FixtureQuery): Promise<Fixture[]> {
    let dates: string | undefined;
    if (q.from && q.to) dates = `${fmtDate(q.from)}-${fmtDate(q.to)}`;
    else if (q.from) dates = fmtDate(q.from);
    const events = await this.scoreboard(dates);
    let out = events.map(fixtureFromEvent);
    if (q.teamCode) out = out.filter((f) => f.home.code === q.teamCode || f.away.code === q.teamCode);
    if (q.stage) out = out.filter((f) => f.stage === q.stage);
    return out;
  }

  async liveMatches(): Promise<LiveMatch[]> {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const events = await this.scoreboard(today);
    return events
      .filter((e) => (e.competitions[0]?.status?.type?.state ?? e.status?.type?.state) === 'in')
      .map(eventToLive);
  }

  async match(id: string): Promise<MatchDetail> {
    const data = await httpJson<{ header?: { competitions?: ESPNCompetition[]; id?: string }; rosters?: Array<{ homeAway: string; roster?: Array<{ athlete?: { displayName?: string; position?: { abbreviation?: string }; jersey?: string } }> }>; gameInfo?: { officials?: Array<{ displayName?: string; position?: { name?: string } }> } }>(
      `${BASE}/summary?event=${id}`,
    );
    const comp = data.header?.competitions?.[0];
    if (!comp || !data.header) throw new WC26Error('NOT_FOUND', `match ${id} not found`);
    const ev: ESPNEvent = { id: data.header.id ?? id, date: comp.date, competitions: [comp] };
    const live = eventToLive(ev);
    const homeRoster = data.rosters?.find((r) => r.homeAway === 'home')?.roster ?? [];
    const awayRoster = data.rosters?.find((r) => r.homeAway === 'away')?.roster ?? [];
    const mapPlayer = (r: { athlete?: { displayName?: string; position?: { abbreviation?: string }; jersey?: string } }) => ({
      name: r.athlete?.displayName ?? '?',
      position: r.athlete?.position?.abbreviation ?? '',
      number: r.athlete?.jersey ? Number(r.athlete.jersey) : undefined,
    });
    const ref = data.gameInfo?.officials?.find((o) => /referee/i.test(o.position?.name ?? ''))?.displayName;
    return {
      ...live,
      lineups: { home: homeRoster.map(mapPlayer), away: awayRoster.map(mapPlayer) },
      stats: {},
      referee: ref,
    };
  }

  async standings(group?: string): Promise<GroupStanding[]> {
    const data = await httpJson<{
      children?: Array<{
        name?: string;
        abbreviation?: string;
        standings?: { entries?: Array<{
          team: { abbreviation?: string; displayName: string };
          stats: Array<{ name: string; value: number }>;
        }> };
      }>;
    }>(`${STANDINGS_BASE}/standings?season=${SEASON}`);
    const stat = (entry: { stats: Array<{ name: string; value: number }> }, names: string[]): number => {
      for (const n of names) {
        const s = entry.stats.find((x) => x.name === n);
        if (s && typeof s.value === 'number') return s.value;
      }
      return 0;
    };
    const groups: GroupStanding[] = [];
    for (const child of data.children ?? []) {
      const label = (child.abbreviation ?? child.name ?? '').match(/[A-Z]$/)?.[0]
        ?? (child.name ?? '').replace(/^Group\s+/i, '').trim();
      if (!label) continue;
      groups.push({
        group: label.toUpperCase(),
        rows: (child.standings?.entries ?? []).map((e) => ({
          team: { code: (e.team.abbreviation ?? e.team.displayName.slice(0, 3)).toUpperCase(), name: e.team.displayName },
          p: stat(e, ['gamesPlayed']),
          w: stat(e, ['wins']),
          d: stat(e, ['ties', 'draws']),
          l: stat(e, ['losses']),
          gf: stat(e, ['pointsFor', 'goalsFor']),
          ga: stat(e, ['pointsAgainst', 'goalsAgainst']),
          gd: stat(e, ['pointDifferential', 'goalDifferential', 'differential']),
          pts: stat(e, ['points']),
        })),
      });
    }
    groups.sort((a, b) => a.group.localeCompare(b.group));
    return group ? groups.filter((g) => g.group === group.toUpperCase()) : groups;
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
      sports?: Array<{ leagues?: Array<{ teams?: Array<{ team: { id: string; abbreviation?: string; displayName: string } }> }> }>;
    }>(`${BASE}/teams`);
    const teams = data.sports?.[0]?.leagues?.[0]?.teams ?? [];
    const match = teams.find((t) => (t.team.abbreviation ?? '').toUpperCase() === code.toUpperCase());
    if (!match) throw new WC26Error('NOT_FOUND', `team ${code} not found`);
    const t = match.team;
    let squad: Team['squad'] = [];
    try {
      const roster = await httpJson<{
        athletes?: Array<{ displayName?: string; position?: { abbreviation?: string }; jersey?: string }>;
      }>(`${BASE}/teams/${t.id}/roster`);
      squad = (roster.athletes ?? []).map((a) => ({
        name: a.displayName ?? '?',
        position: a.position?.abbreviation ?? '',
        number: a.jersey ? Number(a.jersey) : undefined,
      }));
    } catch {
      squad = [];
    }
    const fixtures = await this.fixtures({ teamCode: code });
    return {
      code: (t.abbreviation ?? code).toUpperCase(),
      name: t.displayName,
      squad,
      fixtures,
    };
  }
}
