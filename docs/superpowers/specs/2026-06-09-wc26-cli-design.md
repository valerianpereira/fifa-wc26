# wc26 — FIFA World Cup 2026 CLI

**Status:** Design
**Date:** 2026-06-09
**Owner:** bmsanalytics@bookmyshow.com

## Summary

`wc26` is a Node.js / TypeScript command-line utility that surfaces FIFA World Cup 2026 fixtures, live scores, group standings, knockout brackets, and team details directly in the terminal. It targets developers and football fans who prefer the CLI over web/app UIs and want output that pipes cleanly into shell tooling.

## Goals

- Single `wc26` binary installable via `npm i -g wc26`.
- Realtime live scores with both an interactive watch dashboard and a one-shot mode.
- Pretty default output plus `--plain` and `--json` modes for scripting.
- Multi-provider data layer that fails over automatically and tolerates rate limits.
- Local cache so common reads are instant and the tool degrades gracefully when offline.

## Non-goals

- Push notifications, webhooks, ICS calendar export, prediction pools, shell prompt widgets — explicitly out of scope for v1 (may be revisited later).
- Non-WC2026 competitions.
- Mobile / web UI.

## Architecture

```
wc26-cli/
├── src/
│   ├── cli.ts                 # commander entry, subcommand wiring
│   ├── commands/              # one file per subcommand
│   │   ├── fixtures.ts
│   │   ├── next.ts
│   │   ├── live.ts
│   │   ├── match.ts
│   │   ├── groups.ts
│   │   ├── bracket.ts
│   │   ├── team.ts
│   │   ├── config.ts
│   │   └── cache.ts
│   ├── providers/
│   │   ├── types.ts           # Provider interface + domain types
│   │   ├── api-football.ts    # api-football.com (RapidAPI) adapter
│   │   ├── football-data.ts   # football-data.org adapter
│   │   └── registry.ts        # provider chain w/ failover + circuit breaker
│   ├── cache/
│   │   └── json-cache.ts      # ~/.wc26/cache, TTL per resource
│   ├── render/
│   │   ├── pretty.ts          # cli-table3 + chalk
│   │   ├── plain.ts           # tab-separated
│   │   ├── json.ts            # raw normalized JSON
│   │   ├── bracket.ts         # ASCII bracket renderer
│   │   └── live-dashboard.tsx # ink component for `live --watch`
│   ├── config/
│   │   └── store.ts           # ~/.wc26/config.json
│   ├── http/
│   │   └── client.ts          # undici wrapper w/ retry + backoff
│   ├── errors.ts
│   └── index.ts
├── tests/                     # vitest
├── package.json               # bin: { wc26: dist/cli.js }
├── tsconfig.json
└── README.md
```

## Commands

The binary is `wc26`. Every command accepts the global flags:

- `--json` — emit normalized JSON to stdout.
- `--plain` — tab-separated, no color, no unicode box drawing.
- `--no-cache` — skip cache read (cache write still happens).
- `--provider <name>` — force a specific provider (skip the chain).
- `--verbose` — include stack traces on error.

| Command | Purpose | Example |
| --- | --- | --- |
| `wc26 fixtures [--team XXX] [--from YYYY-MM-DD] [--to ...] [--stage group\|r16\|qf\|sf\|final]` | List fixtures filtered by team / date / stage. | `wc26 fixtures --team ARG --from today` |
| `wc26 next [--team XXX] [-n 5]` | Show the next N upcoming matches. | `wc26 next -n 3` |
| `wc26 live [--watch [--interval 15]]` | Snapshot of live matches, or an ink-driven dashboard when `--watch`. | `wc26 live --watch` |
| `wc26 match <id>` | Full match detail: lineups, event timeline, statistics. | `wc26 match 4587` |
| `wc26 groups [GROUP]` | Group-stage standings table(s). | `wc26 groups A` |
| `wc26 bracket [--from r16]` | ASCII knockout bracket, scores filled in as games complete. | `wc26 bracket` |
| `wc26 team <code>` | Team info, squad, recent + upcoming fixtures. | `wc26 team BRA` |
| `wc26 config set <key> <value>` | Persist API keys, favorite team, defaults. | `wc26 config set favorite ARG` |
| `wc26 config get <key>` | Read a config value. | `wc26 config get favorite` |
| `wc26 cache clear [--resource fixtures]` | Drop cached files. | `wc26 cache clear` |

### `live --watch` UX

Interactive ink component, two panes:

- Top: live matches grid (minute, score, possession indicator).
- Bottom: today's upcoming matches with countdown.

Keys: `q` quit, `r` force refresh, `t` toggle favorite-team-only filter, `?` help.

Refresh interval defaults to 15 s and is clamped to `max(userInterval, providerMinPoll)` (10 s minimum) to respect rate limits.

## Data flow

```
cli.ts (commander)
  → command handler
    → providerRegistry.get(resource, params)
        ↓ try primary provider
        ↓ on 429 / 5xx / timeout / schema-mismatch → next provider
        ↓ on all providers failed → read stale cache, tag output [STALE]
      → cache.write(key, data, ttl)
    → renderer.{pretty|plain|json}(data)
```

## Provider contract

Defined in `src/providers/types.ts`. Every provider implements the same interface, returning the normalized domain types — adapters translate vendor payloads.

```ts
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

export interface FixtureQuery {
  teamCode?: string;     // FIFA 3-letter code
  from?: string;         // ISO date
  to?: string;
  stage?: 'group' | 'r16' | 'qf' | 'sf' | 'final';
}
```

### Normalized domain types

- `Fixture { id, utcKickoff, stage, group?, home: TeamRef, away: TeamRef, venue, status, score? }`
- `LiveMatch extends Fixture { minute, events: MatchEvent[] }`
- `MatchDetail extends LiveMatch { lineups, stats, referee }`
- `GroupStanding { group, rows: [{team, p, w, d, l, gf, ga, gd, pts}] }`
- `BracketNode { stage, matchId?, home?, away?, winner? }`
- `Team { code, name, squad: Player[], coach, group?, fixtures: Fixture[] }`

All provider responses are validated with `zod` schemas at the adapter boundary. Validation failure is treated as a provider error and triggers failover.

### Registry + failover

`registry.ts` reads the ordered provider list from config (default: `['api-football', 'football-data']`) and iterates through it for each call.

- Skip providers where `isConfigured() === false`.
- Failover triggers: HTTP `429`, HTTP `5xx`, `ETIMEDOUT`, `ECONNREFUSED`, zod schema-validation error.
- Circuit breaker: 3 consecutive failures → mark provider unhealthy for 5 minutes.
- If every provider fails, read stale cache and tag the result `[STALE]` / `"stale": true`.

## Cache

Layout under `~/.wc26/cache/`:

```
fixtures/all.json
fixtures/team-ARG.json
live/all.json
match/4587.json
standings/group-A.json
bracket/all.json
team/BRA.json
```

Every file uses the envelope:

```json
{ "fetchedAt": "2026-06-09T10:22:00Z", "ttlSec": 21600, "provider": "api-football", "data": { ... } }
```

### TTLs

| Resource | TTL | Stale-OK on fail |
| --- | --- | --- |
| `fixtures` | 6 h | yes (mark `[STALE]`) |
| `standings` | 1 h | yes |
| `bracket` | 1 h | yes |
| `team`, `match` (finished) | 24 h | yes |
| `match` (live) | 10 s | yes |
| `live` | 10 s | yes |

Read semantics: if `now - fetchedAt < ttlSec` → hit. Otherwise fetch fresh; on fetch failure return stale data with a flag. `--no-cache` skips the read but still writes.

## Configuration

`~/.wc26/config.json`:

```json
{
  "favoriteTeam": "ARG",
  "providers": ["api-football", "football-data"],
  "apiKeys": { "api-football": "...", "football-data": "..." },
  "defaults": { "watchIntervalSec": 15, "output": "pretty" }
}
```

API keys: env vars take precedence over the config file (`WC26_APIFOOTBALL_KEY`, `WC26_FOOTBALLDATA_KEY`). The config file is created with mode `0600`.

## Errors

```ts
export class WC26Error extends Error {
  constructor(public code: ErrorCode, msg: string, public cause?: unknown) { super(msg); }
}
export type ErrorCode =
  | 'NO_PROVIDER_CONFIGURED'
  | 'RATE_LIMIT'
  | 'PROVIDER_UNREACHABLE'
  | 'SCHEMA_MISMATCH'
  | 'NOT_FOUND'
  | 'CACHE_MISS_OFFLINE'
  | 'CONFIG_INVALID';
```

### Exit codes

| Code | Meaning |
| --- | --- |
| 0 | success |
| 1 | generic failure |
| 2 | bad usage (from commander) |
| 3 | no provider configured |
| 4 | all providers failed and no cache to fall back on |
| 5 | not found (team / match) |

### Rate limiting + retries

- Respect the `Retry-After` header when present.
- Exponential backoff: 1 s → 2 s → 4 s, up to 3 retries per request.
- After retry exhaustion, fail over to the next provider.
- `--watch` interval is clamped to the larger of the user value and the provider minimum.

### Offline behavior

- Detect `ENOTFOUND` / `ECONNREFUSED` as offline.
- Serve cached data with an `[OFFLINE]` banner (pretty mode) or `"stale": true, "reason": "offline"` (JSON).
- If nothing is cached, exit 4 with a clear hint.

### User-facing error UX

- Pretty mode prints a red one-liner plus a recovery hint, e.g. `✗ no api key. run: wc26 config set apiKey api-football <KEY>`.
- `--plain` and `--json` keep stderr machine-parseable.
- `--verbose` adds a stack trace.

## Testing

Framework: `vitest`. HTTP mocking: `msw` (or `nock` for low-level cases).

| Layer | Strategy |
| --- | --- |
| Providers | Fixture-based tests per endpoint: happy path, 429, 5xx, malformed response. |
| Registry | Mock two providers; assert failover order, circuit breaker, cache fallback. |
| Cache | Use a tmp dir; cover TTL boundaries, stale-on-fail, `--no-cache`. |
| Renderers | Snapshot tests for pretty / plain / json against canned domain objects. |
| Commands | Spawn `wc26` against a mocked provider; assert stdout, stderr, exit code. |
| Bracket | Golden ASCII snapshot for 16 / 8 / 4 / 2 / 1 fill states. |

Coverage target: ≥85% lines overall, 100% on providers, cache, and registry.

## Tooling

| Concern | Choice |
| --- | --- |
| CLI parsing | `commander` |
| Interactive TUI (`live --watch`) | `ink` + `ink-table` |
| Default render | `cli-table3` + `chalk` |
| HTTP | `undici` (with custom retry wrapper) |
| Validation | `zod` |
| Bundling | `tsup` (single-file CJS bundle for the `bin`) |
| Tests | `vitest` + `msw` |
| Lint / format | `eslint` + `prettier` |
| CI | GitHub Actions: matrix on node 20 / 22 — lint, typecheck (`tsc --noEmit`), test, build, pack |

## Open questions

None — all decisions in this document are accepted.

## Out of scope (revisit later)

- Desktop notifications and slack / discord webhooks.
- ICS calendar export.
- Local-only prediction pool with leaderboard.
- Shell-prompt widget (PS1 fragment showing the next match).
- Player-level deep stats (xG, heatmaps).
