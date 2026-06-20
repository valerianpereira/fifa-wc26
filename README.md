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

Default providers work keyless (`espn`, `thesportsdb`). The bundled `football-data` provider talks to a project-hosted proxy (no user-side key required); see [Providers](#providers) for proxy details.

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
- `--provider <name>` — force a specific provider (`football-data`, `espn`, `thesportsdb`)
- `--verbose` — include stack traces on error

## Providers

`wc26` chains providers with automatic failover:

1. `football-data` (api.football-data.org via the project proxy — full 104-match WC schedule + knockout stages; activates when a proxy URL is baked into the build or `WC26_PROXY_URL` is set)
2. `espn` (site.api.espn.com — keyless)
3. `thesportsdb` (thesportsdb.com — free tier uses key `3`; set a paid key for higher limits)

Set a paid `thesportsdb` key via env var (`WC26_THESPORTSDB_KEY`) or `wc26 config set apiKey thesportsdb <key>`.

### football-data proxy

The football-data.org API token is **not** shipped to end users. Requests are
forwarded through a small Vercel Edge Function (`proxy/vercel/`) that attaches
the token server-side and CDN-caches responses to amortize the 10 req/min
upstream limit.

Maintainers: deploy the proxy, then set the resulting URL once before
publishing:

```bash
cd proxy/vercel
npm install && npx vercel login && npx vercel link
npx vercel env add FOOTBALL_DATA_TOKEN production   # paste token when prompted
npm run deploy                                       # prints https://<project>.vercel.app
```

Then edit `DEFAULT_PROXY_BASE` in `src/providers/football-data.ts` to that URL
and `npm run build`. End users get the proxied provider automatically; no key,
no signup. Override at runtime with `WC26_PROXY_URL=...`.

## Cache

JSON files under `~/.wc26/cache/`. TTLs: fixtures 6 h, standings 1 h, bracket 1 h, finished match 24 h, live 10 s. On provider failure the CLI serves stale cache and tags output `[STALE]` (or `"stale": true` in JSON).

## License

MIT.
