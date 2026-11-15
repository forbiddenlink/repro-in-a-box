import { Command } from 'commander';
import { exportScanSummary, SUMMARY_NOTICE } from '../../bundler/summary.js';

export const exportSummaryCommand = new Command('export-summary')
  .description('Export aggregate counts only; no HAR, screenshots, replay or uploads')
  .argument('<scan-results>', 'Explicit local scan-results JSON file (maximum 5 MiB)')
  .requiredOption('-o, --output <new-zip>', 'New destination ZIP; never overwrites an existing file')
  .action(async (input: string, options: { output: string }) => {
    try {
      await exportScanSummary(input, options.output);
      console.log(SUMMARY_NOTICE);
    } catch {
      // Do not echo paths, input contents, or arbitrary errors into logs.
      console.error('Summary export failed. Check the scan JSON, 5 MiB limit, and a writable, unused destination. No raw fallback was exported.');
      process.exitCode = 1;
    }
  });
