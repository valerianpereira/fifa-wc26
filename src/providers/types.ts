import { z } from 'zod';

export const TeamRefSchema = z.object({
  code: z.string().min(2).max(3),
  name: z.string().min(1),
});
export type TeamRef = z.infer<typeof TeamRefSchema>;

export const StageSchema = z.enum(['group', 'r16', 'qf', 'sf', 'third', 'final']);
export type Stage = z.infer<typeof StageSchema>;

export const StatusSchema = z.enum(['scheduled', 'live', 'finished', 'postponed', 'cancelled']);
export type Status = z.infer<typeof StatusSchema>;

export const ScoreSchema = z.object({
  home: z.number().int().nonnegative(),
  away: z.number().int().nonnegative(),
  homePens: z.number().int().nonnegative().optional(),
  awayPens: z.number().int().nonnegative().optional(),
});
export type Score = z.infer<typeof ScoreSchema>;

export const FixtureSchema = z.object({
  id: z.string(),
  utcKickoff: z.string(),
  stage: StageSchema,
  group: z.string().optional(),
  home: TeamRefSchema,
  away: TeamRefSchema,
  venue: z.string(),
  status: StatusSchema,
  score: ScoreSchema.optional(),
});
export type Fixture = z.infer<typeof FixtureSchema>;

export const MatchEventSchema = z.object({
  minute: z.number().int(),
  type: z.enum(['goal', 'own-goal', 'penalty', 'yellow', 'red', 'sub', 'var']),
  team: z.enum(['home', 'away']),
  player: z.string().optional(),
  detail: z.string().optional(),
});
export type MatchEvent = z.infer<typeof MatchEventSchema>;

export const LiveMatchSchema = FixtureSchema.extend({
  minute: z.number().int().min(0),
  events: z.array(MatchEventSchema),
});
export type LiveMatch = z.infer<typeof LiveMatchSchema>;

export const PlayerSchema = z.object({
  name: z.string(),
  position: z.string(),
  number: z.number().int().optional(),
  club: z.string().optional(),
});
export type Player = z.infer<typeof PlayerSchema>;

export const MatchDetailSchema = LiveMatchSchema.extend({
  lineups: z.object({ home: z.array(PlayerSchema), away: z.array(PlayerSchema) }),
  stats: z.record(z.string(), z.object({ home: z.number(), away: z.number() })),
  referee: z.string().optional(),
});
export type MatchDetail = z.infer<typeof MatchDetailSchema>;

export const StandingRowSchema = z.object({
  team: TeamRefSchema,
  p: z.number().int(), w: z.number().int(), d: z.number().int(), l: z.number().int(),
  gf: z.number().int(), ga: z.number().int(), gd: z.number().int(), pts: z.number().int(),
});
export const GroupStandingSchema = z.object({
  group: z.string(),
  rows: z.array(StandingRowSchema),
});
export type GroupStanding = z.infer<typeof GroupStandingSchema>;

export const BracketNodeSchema = z.object({
  stage: z.enum(['r16', 'qf', 'sf', 'third', 'final']),
  matchId: z.string().optional(),
  home: TeamRefSchema.optional(),
  away: TeamRefSchema.optional(),
  winner: TeamRefSchema.optional(),
});
export type BracketNode = z.infer<typeof BracketNodeSchema>;

export const TeamSchema = z.object({
  code: z.string(),
  name: z.string(),
  group: z.string().optional(),
  coach: z.string().optional(),
  squad: z.array(PlayerSchema),
  fixtures: z.array(FixtureSchema),
});
export type Team = z.infer<typeof TeamSchema>;

export interface FixtureQuery {
  teamCode?: string;
  from?: string;
  to?: string;
  stage?: Stage;
}

export interface Provider {
  name: string;
  isConfigured(): boolean;
  fixtures(params: FixtureQuery): Promise<Fixture[]>;
  liveMatches(): Promise<LiveMatch[]>;
  match(id: string): Promise<MatchDetail>;
  standings(group?: string): Promise<GroupStanding[]>;
  knockoutBracket(): Promise<BracketNode[]>;
  team(code: string): Promise<Team>;
}
