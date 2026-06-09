import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigStore } from '../../src/config/store.js';

let root: string;
beforeEach(() => (root = mkdtempSync(join(tmpdir(), 'wc26cfg-'))));
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  delete process.env.WC26_APIFOOTBALL_KEY;
  delete process.env.WC26_FOOTBALLDATA_KEY;
});

describe('ConfigStore', () => {
  it('returns defaults when no file exists', async () => {
    const c = new ConfigStore(root);
    const cfg = await c.load();
    expect(cfg.providers).toEqual(['api-football', 'football-data']);
    expect(cfg.defaults.watchIntervalSec).toBe(15);
    expect(cfg.defaults.output).toBe('pretty');
    expect(cfg.favoriteTeam).toBeUndefined();
  });

  it('round-trips set/get and writes 0600', async () => {
    const c = new ConfigStore(root);
    await c.set('favoriteTeam', 'ARG');
    const cfg = await c.load();
    expect(cfg.favoriteTeam).toBe('ARG');
    const mode = statSync(join(root, 'config.json')).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it('apiKey env vars override file', async () => {
    const c = new ConfigStore(root);
    await c.setApiKey('api-football', 'from-file');
    process.env.WC26_APIFOOTBALL_KEY = 'from-env';
    expect(await c.apiKey('api-football')).toBe('from-env');
  });

  it('apiKey falls back to file when env unset', async () => {
    const c = new ConfigStore(root);
    await c.setApiKey('football-data', 'fileval');
    expect(await c.apiKey('football-data')).toBe('fileval');
  });
});
