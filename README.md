# wc26

FIFA World Cup 2026 CLI: fixtures, live scores, group standings, ASCII bracket, team lookup.

## Install

```bash
npm i -g wc26
```

## Quick start

```bash
wc26 config set apiKey api-football <YOUR_KEY>
# or:  export WC26_APIFOOTBALL_KEY=...

wc26 fixtures --team ARG --from today
wc26 next -n 3
wc26 live --watch
wc26 groups A
wc26 bracket
wc26 team BRA
```

## Global flags

- `--json` — JSON to stdout
- `--plain` — TSV, no color
- `--no-cache` — skip cache read
- `--provider <name>` — force a specific provider (`api-football`, `football-data`)
- `--verbose` — include stack traces on error

## Providers

`wc26` chains providers with automatic failover:

1. `api-football` (RapidAPI / api-sports)
2. `football-data` (football-data.org)

Set keys via env vars (`WC26_APIFOOTBALL_KEY`, `WC26_FOOTBALLDATA_KEY`) or `wc26 config set apiKey <provider> <key>`.

## Cache

JSON files under `~/.wc26/cache/`. TTLs: fixtures 6 h, standings 1 h, bracket 1 h, finished match 24 h, live 10 s. On provider failure the CLI serves stale cache and tags output `[STALE]` (or `"stale": true` in JSON).

## License

MIT.
