# wc26-proxy (Vercel Edge Function)

Tiny edge proxy that fronts api.football-data.org with a server-side token.
CLI users hit this proxy; the token never leaves Vercel.

## Deploy

```bash
cd proxy/vercel
npm install
npx vercel login
npx vercel link              # creates a new project (or links existing)
npx vercel env add FOOTBALL_DATA_TOKEN production   # paste token when prompted
npx vercel env add FOOTBALL_DATA_TOKEN preview      # optional
npm run deploy
```

Vercel prints the project URL (e.g. `https://wc26-proxy.vercel.app`).

## Wire the CLI

Edit `src/providers/football-data.ts` in the repo root and set:

```ts
const DEFAULT_PROXY_BASE = 'https://wc26-proxy.vercel.app';
```

Then `npm run build && npm publish` in the repo root. End users get the
proxied provider automatically; no key, no signup. Override at runtime with
`WC26_PROXY_URL=...`.

## Endpoints (whitelist)

- `GET /competitions/WC/matches`
- `GET /competitions/WC/standings`
- `GET /competitions/WC/teams`
- `GET /matches/{id}`
- `GET /teams/{id}`
- `GET /health`

Anything else → 404.

## Cache TTLs (edge, via `s-maxage`)

| Path                           | TTL  |
|--------------------------------|------|
| /competitions/WC/matches       | 5 m  |
| /competitions/WC/standings     | 5 m  |
| /competitions/WC/teams         | 24 h |
| /matches/{id}                  | 30 s |
| /teams/{id}                    | 24 h |

Vercel CDN caches responses by URL — amortizes upstream 10 req/min across all users.

## Local dev

```bash
echo "FOOTBALL_DATA_TOKEN=<your-token>" > .env.local
npm run dev   # http://localhost:8787
curl 'http://localhost:8787/competitions/WC/matches' | jq '.matches | length'
```

## Rotate token

```bash
npx vercel env rm FOOTBALL_DATA_TOKEN production
npx vercel env add FOOTBALL_DATA_TOKEN production
npx vercel deploy --prod     # picks up new env
```

## Optional CORS

If you want browser callers, set `ALLOWED_ORIGINS=https://example.com,...` (or
`*`) via `npx vercel env add ALLOWED_ORIGINS production`. CLI does not need it.
