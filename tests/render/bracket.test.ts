import { describe, it, expect } from 'vitest';
import { renderBracketAscii } from '../../src/render/bracket.js';
import type { BracketNode } from '../../src/providers/types.js';

describe('renderBracketAscii', () => {
  it('shows all knockout stages as columns', () => {
    const nodes: BracketNode[] = [
      { stage: 'r16', matchId: '1', home: { code: 'ARG', name: 'A' }, away: { code: 'BRA', name: 'B' } },
      { stage: 'qf', matchId: '2', home: { code: 'FRA', name: 'F' }, away: { code: 'GER', name: 'G' } },
      { stage: 'sf' }, { stage: 'final' }, { stage: 'third' },
    ];
    const out = renderBracketAscii(nodes);
    for (const h of ['R16', 'QF', 'SF', 'Final', '3rd']) expect(out).toContain(h);
    expect(out).toContain('ARG');
    expect(out).toContain('BRA');
  });

  it('shows TBD for empty slots', () => {
    expect(renderBracketAscii([{ stage: 'final' }])).toContain('TBD');
  });
});
