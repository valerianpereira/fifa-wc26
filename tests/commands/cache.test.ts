import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cacheCmd } from '../../src/commands/cache.js';

let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'wc26-')); process.env.WC26_HOME = root; });
afterEach(() => { rmSync(root, { recursive: true, force: true }); delete process.env.WC26_HOME; });

describe('cache command', () => {
  it('clear removes the cache dir', async () => {
    const { JsonCache } = await import('../../src/cache/json-cache.js');
    const c = new JsonCache(join(root, 'cache'));
    await c.write('x', 1, 60, 'p');
    expect(existsSync(join(root, 'cache', 'x.json'))).toBe(true);
    const program = new Command();
    cacheCmd(program);
    await program.parseAsync(['node', 'wc26', 'cache', 'clear']);
    expect(existsSync(join(root, 'cache', 'x.json'))).toBe(false);
  });
});
