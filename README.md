# wc26

FIFA World Cup 2026 CLI: fixtures, live scores, group standings, ASCII bracket, team lookup.

## Install

```bash
npm i -g fifa-wc26
# or run without install:
npx fifa-wc26 next
```

The package name is `fifa-wc26`; the binary it installs is `wc26`.

## Quick start

No key required for the default providers (`espn`, `thesportsdb`).

```bash
wc26 fixtures --team ARG --from today
wc26 next -n 3
wc26 live --watch
wc26 groups A
wc26 bracket
wc26 team BRA
```

Optional: bring your own paid `thesportsdb` key for higher rate limits:

```bash
wc26 config set apiKey thesportsdb <YOUR_KEY>
# or via env:
export WC26_THESPORTSDB_KEY=...
```

## Global flags

- `--json` — JSON to stdout
- `--plain` — TSV, no color
- `--no-cache` — skip cache read
- `--provider <name>` — force a specific provider (`espn`, `thesportsdb`)
- `--verbose` — include stack traces on error

## Providers

`wc26` chains keyless providers with automatic failover:

1. `espn` (site.api.espn.com — keyless)
2. `thesportsdb` (thesportsdb.com — free tier uses key `3`; set a paid key for higher limits)

Set a paid `thesportsdb` key via env var (`WC26_THESPORTSDB_KEY`) or `wc26 config set apiKey thesportsdb <key>`.

## Cache

JSON files under `~/.wc26/cache/`. TTLs: fixtures 6 h, standings 1 h, bracket 1 h, finished match 24 h, live 10 s. On provider failure the CLI serves stale cache and tags output `[STALE]` (or `"stale": true` in JSON).

## License

MIT.
