import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonCache } from '../../src/cache/json-cache.js';

let root: string;
beforeEach(() => (root = mkdtempSync(join(tmpdir(), 'wc26-'))));
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('JsonCache', () => {
  it('write then fresh read returns data', async () => {
    const c = new JsonCache(root);
    await c.write('fixtures/all', { x: 1 }, 60, 'api-football');
    expect(await c.read<{ x: number }>('fixtures/all', { allowStale: false })).toEqual({
      data: { x: 1 }, stale: false, fetchedAt: expect.any(String), provider: 'api-football',
    });
  });

  it('expired entry not returned when allowStale=false', async () => {
    const c = new JsonCache(root);
    await c.write('live/all', { x: 1 }, 0, 'p');
    await new Promise((r) => setTimeout(r, 10));
    expect(await c.read('live/all', { allowStale: false })).toBeNull();
  });

  it('expired entry returned with stale=true when allowStale=true', async () => {
    const c = new JsonCache(root);
    await c.write('live/all', { x: 1 }, 0, 'p');
    await new Promise((r) => setTimeout(r, 10));
    const r = await c.read<{ x: number }>('live/all', { allowStale: true });
    expect(r).not.toBeNull();
    expect(r!.stale).toBe(true);
    expect(r!.data).toEqual({ x: 1 });
  });

  it('clear removes all files', async () => {
    const c = new JsonCache(root);
    await c.write('a', 1, 60, 'p');
    await c.write('b', 2, 60, 'p');
    await c.clear();
    expect(await c.read('a')).toBeNull();
    expect(await c.read('b')).toBeNull();
  });

  it('clear with resource only removes that prefix', async () => {
    const c = new JsonCache(root);
    await c.write('fixtures/all', 1, 60, 'p');
    await c.write('live/all', 2, 60, 'p');
    await c.clear('fixtures');
    expect(await c.read('fixtures/all')).toBeNull();
    expect((await c.read('live/all'))!.data).toBe(2);
  });

  it('sanitizes traversal attempts in keys', async () => {
    const c = new JsonCache(root);
    await c.write('../../../escape', { x: 1 }, 60, 'p');
    const r = await c.read<{ x: number }>('../../../escape');
    expect(r?.data).toEqual({ x: 1 });
    // confirm no file was created outside root
    const { existsSync } = await import('node:fs');
    const { join } = await import('node:path');
    expect(existsSync(join(root, '..', '..', '..', 'escape.json'))).toBe(false);
  });
});
