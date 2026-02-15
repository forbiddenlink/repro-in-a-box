#!/usr/bin/env node
/**
 * Repro-in-a-Box CLI
 * Find bugs. Freeze them. Ship them.
 */
import { Command } from 'commander';
import { scanCommand } from './commands/scan.js';
import { validateCommand } from './commands/validate.js';
import { diffCommand } from './commands/diff.js';

const program = new Command();

program
  .name('repro')
  .description('Find bugs. Freeze them. Ship them.')
  .version('2.0.0');

// Scan command: Detect issues on a site
program.addCommand(scanCommand);

// Validate command: Verify reproducibility via HAR replay
program.addCommand(validateCommand);

// Diff command: Compare two scan results
program.addCommand(diffCommand);

program.parse();
