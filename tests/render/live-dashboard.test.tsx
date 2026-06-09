import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { Dashboard } from '../../src/render/live-dashboard.js';
import type { LiveMatch, Fixture } from '../../src/providers/types.js';

const live: LiveMatch = {
  id: '7', utcKickoff: '2026-06-15T18:00:00.000Z', stage: 'group', group: 'A',
  home: { code: 'ARG', name: 'Argentina' }, away: { code: 'BRA', name: 'Brazil' },
  venue: 'V', status: 'live', minute: 23, score: { home: 1, away: 0 }, events: [],
};
const upcoming: Fixture = { ...live, status: 'scheduled', utcKickoff: '2026-06-16T18:00:00.000Z' };

describe('Dashboard', () => {
  it('renders live and upcoming sections with team codes', () => {
    const { lastFrame } = render(<Dashboard live={[live]} upcoming={[upcoming]} stale={false} favoriteOnly={false} />);
    const frame = lastFrame() ?? '';
    expect(frame).toMatch(/LIVE/);
    expect(frame).toMatch(/ARG/);
    expect(frame).toMatch(/BRA/);
    expect(frame).toMatch(/Upcoming/);
  });

  it('shows [STALE] badge when stale', () => {
    const { lastFrame } = render(<Dashboard live={[]} upcoming={[]} stale={true} favoriteOnly={false} reason="offline" />);
    expect(lastFrame() ?? '').toMatch(/STALE/);
  });
});
