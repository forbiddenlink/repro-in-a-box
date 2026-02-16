import { Command } from 'commander';
import { validateReproducibility, type ValidationResult } from '../../determinism/replayer.js';
import { analyzeConsistency, formatDiff, diffScans } from '../../determinism/diff.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';
import { logger, createChildLogger } from '../../utils/logger.js';
import { ValidationError, handleError } from '../../utils/errors.js';

/**
 * Constants for reproducibility scoring
 */
const REPRODUCIBILITY_THRESHOLDS = {
  EXCELLENT: 90,
  GOOD: 80,
  FAIR: 70,
  DEFAULT_THRESHOLD: 70,
  DEFAULT_RUNS: 3,
  MAX_ERRORS_DISPLAYED: 3
};

export const validateCommand = new Command('validate')
  .description('Validate reproducibility of a scan bundle')
  .argument('<bundle>', 'Path to the bundle ZIP file')
  .option('-r, --runs <number>', 'Number of replay runs', String(REPRODUCIBILITY_THRESHOLDS.DEFAULT_RUNS))
  .option('-o, --output <dir>', 'Output directory for extracted bundle and results')
  .option('--json', 'Output results as JSON')
  .option('-t, --threshold <percentage>', 'Success threshold percentage', String(REPRODUCIBILITY_THRESHOLDS.DEFAULT_THRESHOLD))
  .option('-v, --verbose', 'Show detailed diff analysis')
  .action(async (bundlePath: string, options: { 
    runs: string; 
    output?: string; 
    json?: boolean; 
    threshold: string;
    verbose?: boolean;
  }) => {
    logger.configure({ verbose: options.verbose === true });
    const validateLogger = createChildLogger({ bundlePath, command: 'validate' });

    try {
      const runs = parseInt(options.runs, 10);
      const threshold = parseInt(options.threshold, 10);
      
      if (isNaN(runs) || runs < 1) {
        throw new ValidationError('--runs must be a positive number', { provided: options.runs });
      }
      
      if (isNaN(threshold) || threshold < 0 || threshold > 100) {
        throw new ValidationError('--threshold must be between 0 and 100', { provided: options.threshold });
      }
      
      validateLogger.info('🔍 Validating reproducibility', {
        bundlePath,
        runs,
        threshold,
        output: options.output
      });

      const end = validateLogger.time('Validation');
      const result = await validateReproducibility({
        bundlePath,
        runs,
        outputDir: options.output,
      });
      end();
      
      if (options.json) {
        // JSON output mode
        console.log(JSON.stringify(result, null, 2));
      } else {
        // Human-readable output
        printValidationReport(result, options.verbose, validateLogger);
      }
      
      // Exit with error if reproducibility is below threshold
      if (result.reproducibilityScore < threshold) {
        validateLogger.warn('Reproducibility score below threshold', {
          score: result.reproducibilityScore,
          threshold
        });
        process.exit(1);
      }
      
      validateLogger.info('✅ Validation successful', {
        score: result.reproducibilityScore
      });
    } catch (error) {
      validateLogger.error('Validation failed', error instanceof Error ? error : new Error(String(error)));
      handleError(error);
    }
  });

function printValidationReport(result: ValidationResult, verbose?: boolean, validateLogger?: ReturnType<typeof createChildLogger>): void {
  const { originalScan, replayRuns, reproducibilityScore, summary } = result;
  
  validateLogger?.debug('Validation report', {
    originalScan: originalScan.url,
    runs: replayRuns.length,
    score: reproducibilityScore
  });
  
  // Original scan info
  console.log(chalk.bold('📊 Original Scan'));
  console.log(`   URL: ${originalScan.url}`);
  console.log(`   Date: ${originalScan.timestamp}`);
  console.log(`   Issues: ${originalScan.summary.totalIssues}`);
  console.log('');
  
  // Replay runs
  console.log(chalk.bold('🔄 Replay Runs'));
  for (let i = 0; i < replayRuns.length; i++) {
    const run = replayRuns[i];
    const status = run.success ? chalk.green('✅ Success') : chalk.red('❌ Failed');
    const issues = run.results.summary.totalIssues;
    
    console.log(`   Run ${i + 1}: ${status} - ${issues} issues found`);
    
    if (run.errors.length > 0) {
      console.log(chalk.red(`      Errors: ${run.errors.length}`));
      run.errors.slice(0, REPRODUCIBILITY_THRESHOLDS.MAX_ERRORS_DISPLAYED).forEach(err => {
        console.log(chalk.red(`        - ${err}`));
        validateLogger?.debug('Validation error', { error: err, run: i + 1 });
      });
      if (run.errors.length > REPRODUCIBILITY_THRESHOLDS.MAX_ERRORS_DISPLAYED) {
        console.log(chalk.red(`        ... and ${run.errors.length - REPRODUCIBILITY_THRESHOLDS.MAX_ERRORS_DISPLAYED} more`));
      }
    }
    
    if (run.fallbackRequests.length > 0) {
      console.log(chalk.yellow(`      Fallback requests: ${run.fallbackRequests.length}`));
      validateLogger?.debug('Fallback requests', { count: run.fallbackRequests.length, run: i + 1 });
    }
  }
  console.log('');
  
  // Detailed consistency analysis (verbose mode)
  if (verbose) {
    console.log(chalk.bold('🔬 Consistency Analysis'));
    const consistency = analyzeConsistency(
      originalScan, 
      replayRuns.map(r => r.results)
    );
    
    console.log(`   Always present: ${consistency.summary.totalAlwaysPresent} issues`);
    console.log(`   Never present: ${consistency.summary.totalNeverPresent} issues`);
    console.log(`   Inconsistent: ${consistency.summary.totalInconsistent} issues`);
    console.log(`   Consistency rate: ${consistency.summary.consistencyRate.toFixed(1)}%`);
    console.log('');
    
    validateLogger?.debug('Consistency analysis', consistency.summary);
    
    // Show diff for first replay run
    if (replayRuns.length > 0) {
      console.log(chalk.bold('📋 Diff (Original vs Run 1)'));
      const diff = diffScans(originalScan, replayRuns[0].results);
      console.log(formatDiff(diff));
    }
  }
  
  // Summary
  console.log(chalk.bold('📈 Summary'));
  console.log(`   Total runs: ${summary.totalRuns}`);
  console.log(`   Successful: ${summary.successfulRuns}/${summary.totalRuns}`);
  console.log(`   Average issues: ${summary.averageIssuesFound.toFixed(1)}`);
  console.log('');
  
  // Reproducibility score
  const scoreColor = reproducibilityScore >= REPRODUCIBILITY_THRESHOLDS.EXCELLENT ? chalk.green
                    : reproducibilityScore >= REPRODUCIBILITY_THRESHOLDS.DEFAULT_THRESHOLD ? chalk.yellow
                    : chalk.red;
  
  console.log(chalk.bold('🎯 Reproducibility Score'));
  console.log(`   ${scoreColor(reproducibilityScore.toFixed(1) + '%')}`);
  console.log('');
  
  // Grade
  const grade = reproducibilityScore >= REPRODUCIBILITY_THRESHOLDS.EXCELLENT ? '🥇 Excellent'
              : reproducibilityScore >= REPRODUCIBILITY_THRESHOLDS.GOOD ? '🥈 Good'
              : reproducibilityScore >= REPRODUCIBILITY_THRESHOLDS.FAIR ? '🥉 Fair'
              : '❌ Poor';
  
  console.log(chalk.bold(`   Grade: ${grade}`));
  console.log('');
}
