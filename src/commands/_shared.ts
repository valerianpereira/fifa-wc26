import { homedir } from 'node:os';
import { join } from 'node:path';
import { ConfigStore } from '../config/store.js';
import { JsonCache } from '../cache/json-cache.js';
import { ProviderRegistry } from '../providers/registry.js';
import { EspnProvider } from '../providers/espn.js';
import { TheSportsDbProvider } from '../providers/thesportsdb.js';
import { FootballDataProvider } from '../providers/football-data.js';
import type { Provider } from '../providers/types.js';
import { WC26Error, exitCodeFor } from '../errors.js';

export interface GlobalOpts {
  json?: boolean;
  plain?: boolean;
  noCache?: boolean;
  provider?: string;
  verbose?: boolean;
}

function homeDir(): string {
  return process.env.WC26_HOME ?? join(homedir(), '.wc26');
}

export const env = {
  get config(): ConfigStore { return new ConfigStore(homeDir()); },
  get cache(): JsonCache { return new JsonCache(join(homeDir(), 'cache')); },
};

export async function buildRegistry(opts: GlobalOpts): Promise<ProviderRegistry> {
  const cfg = await env.config.load();
  const names = opts.provider ? [opts.provider] : cfg.providers;
  const providers: Provider[] = [];
  for (const name of names) {
    const key = (await env.config.apiKey(name)) ?? '';
    if (name === 'espn') providers.push(new EspnProvider());
    else if (name === 'thesportsdb') providers.push(new TheSportsDbProvider(key || '3'));
    else if (name === 'football-data') {
      const p = new FootballDataProvider();
      if (p.isConfigured()) providers.push(p);
    }
  }
  return new ProviderRegistry(providers);
}

export interface RunCachedOpts<T> {
  validate?: (data: T) => boolean;
}

export async function runCached<T>(
  key: string,
  ttlSec: number,
  fetcher: () => Promise<{ data: T; provider: string }>,
  opts: GlobalOpts,
  cacheOpts: RunCachedOpts<T> = {},
): Promise<{ data: T; stale: boolean; reason?: string }> {
  const validate = cacheOpts.validate ?? ((): boolean => true);
  if (!opts.noCache) {
    const hit = await env.cache.read<T>(key, { allowStale: false });
    if (hit && validate(hit.data)) return { data: hit.data, stale: false };
  }
  try {
    const { data, provider } = await fetcher();
    if (validate(data)) await env.cache.write(key, data, ttlSec, provider);
    return { data, stale: false };
  } catch (e) {
    const stale = await env.cache.read<T>(key, { allowStale: true });
    if (stale && validate(stale.data)) {
      const reason = e instanceof WC26Error ? e.code.toLowerCase() : 'unreachable';
      return { data: stale.data, stale: true, reason };
    }
    throw e;
  }
}

export function die(e: unknown, opts: GlobalOpts): never {
  if (e instanceof WC26Error) {
    if (opts.json) {
      process.stderr.write(JSON.stringify({ error: { code: e.code, message: e.message } }) + '\n');
    } else {
      process.stderr.write(`✗ ${e.message}\n`);
    }
    if (opts.verbose && e.cause) process.stderr.write(String(e.cause) + '\n');
    process.exit(exitCodeFor(e.code));
  }
  process.stderr.write(String(e) + '\n');
  if (opts.verbose && e instanceof Error && e.stack) process.stderr.write(e.stack + '\n');
  process.exit(1);
}
