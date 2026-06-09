import chalk from 'chalk';
import type { BracketNode } from '../providers/types.js';

const STAGES: Array<{ key: BracketNode['stage']; label: string; slots: number }> = [
  { key: 'r16', label: 'R16', slots: 8 },
  { key: 'qf', label: 'QF', slots: 4 },
  { key: 'sf', label: 'SF', slots: 2 },
  { key: 'final', label: 'Final', slots: 1 },
  { key: 'third', label: '3rd', slots: 1 },
];

const COL_WIDTH = 18;

function pad(s: string, w = COL_WIDTH): string {
  if (s.length >= w) return s.slice(0, w);
  return s + ' '.repeat(w - s.length);
}

function nodeLine(n: BracketNode | undefined): string {
  if (!n) return pad('TBD vs TBD');
  const h = n.home?.code ?? 'TBD';
  const a = n.away?.code ?? 'TBD';
  const w = n.winner ? chalk.bold(n.winner.code) : '';
  return pad(`${h} vs ${a}${w ? ' → ' + w : ''}`);
}

export function renderBracketAscii(nodes: BracketNode[]): string {
  const byStage = new Map<BracketNode['stage'], BracketNode[]>();
  for (const n of nodes) {
    if (!byStage.has(n.stage)) byStage.set(n.stage, []);
    byStage.get(n.stage)!.push(n);
  }

  const lines: string[] = [];
  lines.push(STAGES.map((s) => pad(chalk.bold(s.label))).join(' | '));
  lines.push(STAGES.map(() => '-'.repeat(COL_WIDTH)).join('-+-'));

  const maxRows = Math.max(...STAGES.map((s) => s.slots));
  for (let i = 0; i < maxRows; i++) {
    const row = STAGES.map((s) => {
      const list = byStage.get(s.key) ?? [];
      if (i >= s.slots) return pad('');
      return nodeLine(list[i]);
    }).join(' | ');
    lines.push(row);
  }
  return lines.join('\n');
}
