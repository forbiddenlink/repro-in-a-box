import { Command } from 'commander';
import { logger } from '../../utils/logger.js';

export const diffCommand = new Command('diff')
  .description('Compare two scan results')
  .argument('<scan1>', 'First scan result JSON file')
  .argument('<scan2>', 'Second scan result JSON file')
  .option('-o, --output <path>', 'Output file path for diff result')
  .action(async (scan1: string, scan2: string, options: { output?: string }) => {
    logger.info('⚠️  Diff command coming in Week 5 (result comparison)', {
      scan1,
      scan2,
      output: options.output
    });
    process.exit(0);
  });
