import { readFile, writeFile, mkdir, chmod } from 'node:fs/promises';
import { join } from 'node:path';

export interface Config {
  favoriteTeam?: string;
  providers: string[];
  apiKeys: Record<string, string>;
  defaults: { watchIntervalSec: number; output: 'pretty' | 'plain' | 'json' };
}

const DEFAULTS: Config = {
  providers: ['espn', 'thesportsdb'],
  apiKeys: {},
  defaults: { watchIntervalSec: 15, output: 'pretty' },
};

const ENV_KEYS: Record<string, string> = {
  'thesportsdb': 'WC26_THESPORTSDB_KEY',
};

export class ConfigStore {
  constructor(private root: string) {}

  private file(): string {
    return join(this.root, 'config.json');
  }

  async load(): Promise<Config> {
    try {
      const raw = await readFile(this.file(), 'utf8');
      const parsed = JSON.parse(raw) as Partial<Config>;
      return { ...DEFAULTS, ...parsed, defaults: { ...DEFAULTS.defaults, ...parsed.defaults } };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { ...DEFAULTS };
      throw e;
    }
  }

  private async save(cfg: Config): Promise<void> {
    await mkdir(this.root, { recursive: true });
    await writeFile(this.file(), JSON.stringify(cfg, null, 2), 'utf8');
    await chmod(this.file(), 0o600);
  }

  async set<K extends keyof Config>(key: K, value: Config[K]): Promise<void> {
    const cfg = await this.load();
    (cfg as Config)[key] = value;
    await this.save(cfg);
  }

  async setApiKey(provider: string, key: string): Promise<void> {
    const cfg = await this.load();
    cfg.apiKeys[provider] = key;
    await this.save(cfg);
  }

  async apiKey(provider: string): Promise<string | undefined> {
    const env = ENV_KEYS[provider];
    if (env && process.env[env]) return process.env[env];
    const cfg = await this.load();
    return cfg.apiKeys[provider];
  }
}
