import { describe, it, expect } from 'vitest';
import { WC26Error, exitCodeFor } from '../src/errors.js';

describe('WC26Error', () => {
  it('carries code, message, and optional cause', () => {
    const cause = new Error('boom');
    const e = new WC26Error('RATE_LIMIT', 'too many', cause);
    expect(e.code).toBe('RATE_LIMIT');
    expect(e.message).toBe('too many');
    expect(e.cause).toBe(cause);
    expect(e).toBeInstanceOf(Error);
  });
});

describe('exitCodeFor', () => {
  it.each([
    ['NO_PROVIDER_CONFIGURED', 3],
    ['PROVIDER_UNREACHABLE', 4],
    ['NOT_FOUND', 5],
    ['RATE_LIMIT', 1],
    ['SCHEMA_MISMATCH', 1],
    ['CACHE_MISS_OFFLINE', 4],
    ['CONFIG_INVALID', 1],
  ])('maps %s -> %d', (code, exit) => {
    expect(exitCodeFor(code as never)).toBe(exit);
  });
});
