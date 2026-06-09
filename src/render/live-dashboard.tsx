import React from 'react';
import { Box, Text } from 'ink';
import type { LiveMatch, Fixture } from '../providers/types.js';

export interface DashboardProps {
  live: LiveMatch[];
  upcoming: Fixture[];
  stale: boolean;
  reason?: string;
  favoriteOnly: boolean;
}

function scoreStr(f: { score?: { home: number; away: number } }): string {
  return f.score ? `${f.score.home}-${f.score.away}` : '–';
}

export function Dashboard({ live, upcoming, stale, reason, favoriteOnly }: DashboardProps): JSX.Element {
  return (
    <Box flexDirection="column">
      <Box>
        <Text bold color="cyan">wc26 live</Text>
        <Text> </Text>
        {stale && <Text color="yellow">[STALE{reason ? ' ' + reason : ''}]</Text>}
        {favoriteOnly && <Text color="magenta"> [fav-only]</Text>}
      </Box>
      <Box marginTop={1}><Text bold>LIVE</Text></Box>
      {live.length === 0 ? <Text dimColor>no live matches</Text> :
        live.map((m) => (
          <Box key={m.id}>
            <Text color="green">{String(m.minute).padStart(3)}'</Text>
            <Text>  {m.home.code} {scoreStr(m)} {m.away.code}  </Text>
            <Text dimColor>{m.stage}{m.group ? ' ' + m.group : ''}</Text>
          </Box>
        ))
      }
      <Box marginTop={1}><Text bold>Upcoming</Text></Box>
      {upcoming.length === 0 ? <Text dimColor>none</Text> :
        upcoming.map((f) => (
          <Box key={f.id}>
            <Text dimColor>{f.utcKickoff.replace('T', ' ').replace('.000Z', '')}</Text>
            <Text>  {f.home.code} vs {f.away.code}  </Text>
            <Text dimColor>{f.stage}{f.group ? ' ' + f.group : ''}</Text>
          </Box>
        ))
      }
      <Box marginTop={1}><Text dimColor>q: quit  r: refresh  t: fav-only  ?: help</Text></Box>
    </Box>
  );
}
