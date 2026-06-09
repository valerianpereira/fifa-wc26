import { describe, it, expect } from 'vitest';
import { renderJson } from '../../src/render/json.js';

describe('renderJson', () => {
  it('serializes data with stale=false by default', () => {
    expect(JSON.parse(renderJson({ a: 1 }))).toEqual({ stale: false, data: { a: 1 } });
  });
  it('includes stale + reason when flagged', () => {
    expect(JSON.parse(renderJson({ a: 1 }, { stale: true, reason: 'offline' }))).toEqual({
      stale: true, reason: 'offline', data: { a: 1 },
    });
  });
});
