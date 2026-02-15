import { Command } from 'commander';
import { validateReproducibility } from '../../determinism/replayer.js';
import { analyzeConsistency, formatDiff, diffScans } from '../../determinism/diff.js';
import chalk from 'chalk';
export const validateCommand = new Command('validate')
    .description('Validate reproducibility of a scan bundle')
    .argument('<bundle>', 'Path to the bundle ZIP file')
    .option('-r, --runs <number>', 'Number of replay runs', '3')
    .option('-o, --output <dir>', 'Output directory for extracted bundle and results')
    .option('--json', 'Output results as JSON')
    .option('-t, --threshold <percentage>', 'Success threshold percentage', '70')
    .option('-v, --verbose', 'Show detailed diff analysis')
    .action(async (bundlePath, options) => {
    const runs = parseInt(options.runs, 10);
    const threshold = parseInt(options.threshold, 10);
    if (isNaN(runs) || runs < 1) {
        console.error(chalk.red('❌ Error: --runs must be a positive number'));
        process.exit(1);
    }
    if (isNaN(threshold) || threshold < 0 || threshold > 100) {
        console.error(chalk.red('❌ Error: --threshold must be between 0 and 100'));
        process.exit(1);
    }
    console.log(chalk.bold('\n🔍 Validating reproducibility...\n'));
    console.log(`Bundle: ${bundlePath}`);
    console.log(`Runs: ${runs}`);
    console.log(`Threshold: ${threshold}%`);
    console.log('');
    try {
        const result = await validateReproducibility({
            bundlePath,
            runs,
            outputDir: options.output,
        });
        if (options.json) {
            // JSON output mode
            console.log(JSON.stringify(result, null, 2));
        }
        else {
            // Human-readable output
            printValidationReport(result, options.verbose);
        }
        // Exit with error if reproducibility is below threshold
        if (result.reproducibilityScore < threshold) {
            console.log(chalk.yellow(`\n⚠️  Warning: Reproducibility score below ${threshold}% threshold`));
            process.exit(1);
        }
    }
    catch (error) {
        console.error(chalk.red('\n❌ Validation failed:'));
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
});
function printValidationReport(result, verbose) {
    const { originalScan, replayRuns, reproducibilityScore, summary } = result;
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
            run.errors.slice(0, 3).forEach(err => {
                console.log(chalk.red(`        - ${err}`));
            });
            if (run.errors.length > 3) {
                console.log(chalk.red(`        ... and ${run.errors.length - 3} more`));
            }
        }
        if (run.fallbackRequests.length > 0) {
            console.log(chalk.yellow(`      Fallback requests: ${run.fallbackRequests.length}`));
        }
    }
    console.log('');
    // Detailed consistency analysis (verbose mode)
    if (verbose) {
        console.log(chalk.bold('🔬 Consistency Analysis'));
        const consistency = analyzeConsistency(originalScan, replayRuns.map(r => r.results));
        console.log(`   Always present: ${consistency.summary.totalAlwaysPresent} issues`);
        console.log(`   Never present: ${consistency.summary.totalNeverPresent} issues`);
        console.log(`   Inconsistent: ${consistency.summary.totalInconsistent} issues`);
        console.log(`   Consistency rate: ${consistency.summary.consistencyRate.toFixed(1)}%`);
        console.log('');
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
    const scoreColor = reproducibilityScore >= 90 ? chalk.green
        : reproducibilityScore >= 70 ? chalk.yellow
            : chalk.red;
    console.log(chalk.bold('🎯 Reproducibility Score'));
    console.log(`   ${scoreColor(reproducibilityScore.toFixed(1) + '%')}`);
    console.log('');
    // Grade
    const grade = reproducibilityScore >= 90 ? '🥇 Excellent'
        : reproducibilityScore >= 80 ? '🥈 Good'
            : reproducibilityScore >= 70 ? '🥉 Fair'
                : '❌ Poor';
    console.log(chalk.bold(`   Grade: ${grade}`));
    console.log('');
}
//# sourceMappingURL=validate.js.map