import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { configCmd } from '../../src/commands/config.js';

let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'wc26-')); process.env.WC26_HOME = root; });
afterEach(() => { rmSync(root, { recursive: true, force: true }); delete process.env.WC26_HOME; });

async function run(argv: string[]): Promise<string> {
  const program = new Command();
  configCmd(program);
  const chunks: string[] = [];
  const orig = process.stdout.write.bind(process.stdout);
  (process.stdout.write as unknown as (s: string) => boolean) = (s: string) => { chunks.push(s); return true; };
  try { await program.parseAsync(['node', 'wc26', ...argv]); } finally { process.stdout.write = orig; }
  return chunks.join('');
}

describe('config command', () => {
  it('set then get favoriteTeam', async () => {
    await run(['config', 'set', 'favorite', 'ARG']);
    const out = await run(['config', 'get', 'favorite']);
    expect(out.trim()).toBe('ARG');
  });

  it('set apiKey provider key', async () => {
    await run(['config', 'set', 'apiKey', 'thesportsdb', 'KEY']);
    const out = await run(['config', 'get', 'apiKey', 'thesportsdb']);
    expect(out.trim()).toBe('KEY');
  });
});
