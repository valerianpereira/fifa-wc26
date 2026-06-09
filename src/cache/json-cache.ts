import { mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

interface Envelope<T> {
  fetchedAt: string;
  ttlSec: number;
  provider: string;
  data: T;
}

export interface ReadResult<T> {
  data: T;
  stale: boolean;
  fetchedAt: string;
  provider: string;
}

export interface ReadOpts {
  allowStale?: boolean;
}

export class JsonCache {
  constructor(private root: string) {}

  private pathFor(key: string): string {
    return join(this.root, `${key}.json`);
  }

  async read<T>(key: string, opts: ReadOpts = {}): Promise<ReadResult<T> | null> {
    try {
      const raw = await readFile(this.pathFor(key), 'utf8');
      const env = JSON.parse(raw) as Envelope<T>;
      const age = (Date.now() - new Date(env.fetchedAt).getTime()) / 1000;
      const stale = age >= env.ttlSec;
      if (stale && !opts.allowStale) return null;
      return { data: env.data, stale, fetchedAt: env.fetchedAt, provider: env.provider };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw e;
    }
  }

  async write<T>(key: string, data: T, ttlSec: number, provider: string): Promise<void> {
    const file = this.pathFor(key);
    await mkdir(dirname(file), { recursive: true });
    const env: Envelope<T> = { fetchedAt: new Date().toISOString(), ttlSec, provider, data };
    await writeFile(file, JSON.stringify(env), 'utf8');
  }

  async clear(resource?: string): Promise<void> {
    if (!resource) {
      await rm(this.root, { recursive: true, force: true });
      return;
    }
    const target = join(this.root, resource);
    try {
      const entries = await readdir(target);
      await Promise.all(entries.map((f) => rm(join(target, f), { force: true })));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
  }
}
