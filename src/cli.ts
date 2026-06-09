import { Command } from 'commander';
import { fixturesCmd } from './commands/fixtures.js';
import { nextCmd } from './commands/next.js';
import { liveCmd } from './commands/live.js';
import { matchCmd } from './commands/match.js';
import { groupsCmd } from './commands/groups.js';
import { bracketCmd } from './commands/bracket.js';
import { teamCmd } from './commands/team.js';
import { configCmd } from './commands/config.js';
import { cacheCmd } from './commands/cache.js';

const program = new Command();
program
  .name('wc26')
  .description('FIFA World Cup 2026 CLI')
  .version('0.1.0')
  .option('--json', 'emit JSON to stdout')
  .option('--plain', 'tab-separated, no color')
  .option('--no-cache', 'skip cache read')
  .option('--provider <name>', 'force a specific provider')
  .option('--verbose', 'include stack traces');

fixturesCmd(program);
nextCmd(program);
liveCmd(program);
matchCmd(program);
groupsCmd(program);
bracketCmd(program);
teamCmd(program);
configCmd(program);
cacheCmd(program);

program.parseAsync().catch((e) => {
  process.stderr.write(String(e) + '\n');
  process.exit(1);
});
