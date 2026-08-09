import { Command } from 'commander';
import { readFileSync, writeFileSync } from 'fs';
import chalk from 'chalk';
import { diffScans, formatDiff } from '../../determinism/diff.js';
import type { ScanResults } from '../../scanner/index.js';
import { logger, createChildLogger } from '../../utils/logger.js';
import { ValidationError, handleError } from '../../utils/errors.js';

function loadScanFile(path: string): ScanResults {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    throw new ValidationError(`Cannot read scan file: ${path}`, { path });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ValidationError(`Invalid JSON in scan file: ${path}`, { path });
  }

  const scan = parsed as ScanResults;
  if (!scan || typeof scan !== 'object' || !Array.isArray(scan.pages)) {
    throw new ValidationError(`File does not look like a scan results JSON: ${path}`, { path });
  }

  return scan;
}

export const diffCommand = new Command('diff')
  .description('Compare two scan results')
  .argument('<scan1>', 'First scan result JSON file (baseline)')
  .argument('<scan2>', 'Second scan result JSON file (comparison)')
  .option('-o, --output <path>', 'Output file path for diff result (JSON)')
  .option('--json', 'Print diff as JSON to stdout')
  .action(async (scan1: string, scan2: string, options: { output?: string; json?: boolean }) => {
    const diffLogger = createChildLogger({ command: 'diff', scan1, scan2 });

    try {
      diffLogger.info('Comparing scan results', { scan1, scan2 });

      const baseline = loadScanFile(scan1);
      const comparison = loadScanFile(scan2);
      const diff = diffScans(baseline, comparison);

      if (options.output) {
        writeFileSync(options.output, JSON.stringify(diff, null, 2), 'utf8');
        diffLogger.info('Diff written', { output: options.output });
      }

      if (options.json) {
        console.log(JSON.stringify(diff, null, 2));
      } else {
        printDiffReport(baseline, comparison, diff);
      }
    } catch (error) {
      handleError(error);
    }
  });

function printDiffReport(
  baseline: ScanResults,
  comparison: ScanResults,
  diff: ReturnType<typeof diffScans>
): void {
  console.log('');
  console.log(chalk.bold('Scan Comparison'));
  console.log(chalk.dim('═'.repeat(40)));
  console.log('');
  console.log(chalk.dim('Baseline:  ') + baseline.url);
  console.log(chalk.dim('Comparison:') + ' ' + comparison.url);
  console.log('');
  console.log(chalk.bold('Summary'));
  console.log(`  Match rate:  ${diff.summary.matchPercentage.toFixed(1)}%`);
  console.log(`  Unchanged:   ${diff.summary.totalUnchanged}`);
  console.log(chalk.green(`  Added:       ${diff.summary.totalAdded}`));
  console.log(chalk.red(`  Removed:     ${diff.summary.totalRemoved}`));
  console.log('');
  console.log(formatDiff(diff));
  logger.debug('Diff complete', { summary: diff.summary });
}
