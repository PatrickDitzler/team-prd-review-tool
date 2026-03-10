#!/usr/bin/env tsx
import { Command } from 'commander';
import { printBanner } from './utils/display';
import { registerIngestCommand } from './commands/ingest';
import { registerReviewCommand } from './commands/review';
import { registerBreakdownCommand } from './commands/breakdown';
import { registerEvaluateCommand } from './commands/evaluate';
import { registerExportCommand } from './commands/export';
import { registerRunCommand } from './commands/run';
import { registerConfigCommand } from './commands/config';

const program = new Command();

program
  .name('prd-review')
  .description('PRD Review Tool — CLI interface for reviewing PRDs and generating PBIs')
  .version('0.1.0')
  .hook('preAction', () => {
    // Print banner for non-help commands
    const args = process.argv.slice(2);
    if (!args.includes('--help') && !args.includes('-h')) {
      printBanner();
    }
  });

// Register all commands
registerIngestCommand(program);
registerReviewCommand(program);
registerBreakdownCommand(program);
registerEvaluateCommand(program);
registerExportCommand(program);
registerRunCommand(program);
registerConfigCommand(program);

program.parse(process.argv);
