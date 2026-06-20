import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';

describe('cli smoke', () => {
  it('prints help', () => {
    const out = execFileSync('npx', ['tsx', 'src/cli.ts', '--help'], { encoding: 'utf8' });
    expect(out).toMatch(/Usage: wc26/);
    expect(out).toMatch(/fixtures/);
    expect(out).toMatch(/live/);
    expect(out).toMatch(/bracket/);
  });

  it('prints version', () => {
    const out = execFileSync('npx', ['tsx', 'src/cli.ts', '--version'], { encoding: 'utf8' });
    expect(out.trim()).toBe('0.1.2');
  });
});
