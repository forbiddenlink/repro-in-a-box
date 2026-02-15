import { Command } from 'commander';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { DetectorRegistry, JavaScriptErrorsDetector, NetworkErrorsDetector, BrokenAssetsDetector, AccessibilityDetector, WebVitalsDetector, MixedContentDetector, BrokenLinksDetector, } from '../../detectors/index.js';
import { Scanner } from '../../scanner/index.js';
import { createBundle } from '../../bundler/index.js';
export const scanCommand = new Command('scan')
    .description('Scan a website for issues')
    .argument('<url>', 'URL to scan')
    .option('-d, --max-depth <number>', 'Maximum crawl depth', '2')
    .option('-p, --max-pages <number>', 'Maximum pages to scan', '10')
    .option('-r, --rate-limit <ms>', 'Rate limit between requests', '1000')
    .option('-o, --output <path>', 'Output file path (JSON)')
    .option('--no-headless', 'Run browser in visible mode')
    .option('--same-domain-only', 'Only crawl pages on the same domain', true)
    .option('-b, --bundle', 'Create reproducible bundle (ZIP with HAR + screenshots)')
    .option('--screenshots', 'Capture screenshots when issues are detected')
    .option('--record-har', 'Record HAR file for replay')
    .action(async (url, options) => {
    console.log('🔍 Repro-in-a-Box Scanner');
    console.log('========================\n');
    console.log(`URL: ${url}`);
    console.log(`Max Depth: ${options.maxDepth}`);
    console.log(`Max Pages: ${options.maxPages}`);
    console.log(`Rate Limit: ${options.rateLimit}ms`);
    console.log(`Headless: ${options.headless}`);
    if (options.bundle) {
        console.log(`Bundle: Yes (includes HAR + screenshots)`);
    }
    console.log('');
    // Create registry and register detectors
    const registry = new DetectorRegistry();
    registry.register(new JavaScriptErrorsDetector());
    registry.register(new NetworkErrorsDetector());
    registry.register(new BrokenAssetsDetector());
    registry.register(new AccessibilityDetector());
    registry.register(new WebVitalsDetector());
    registry.register(new MixedContentDetector());
    registry.register(new BrokenLinksDetector());
    console.log('📦 Registered detectors:');
    for (const detector of registry.getEnabled()) {
        console.log(`  - ${detector.name} (${detector.id})`);
    }
    console.log('');
    // Create scanner
    const scanner = new Scanner(registry);
    // Determine output directory
    const outputDir = options.output
        ? (options.output.endsWith('.json') ? join(options.output, '..') : options.output)
        : process.cwd();
    // Configure scan
    const config = {
        url,
        headless: options.headless,
        outputDir,
        screenshots: options.bundle || options.screenshots, // Enable if bundling or explicitly requested
        recordHar: options.bundle || options.recordHar, // Enable if bundling or explicitly requested
        harPath: (options.bundle || options.recordHar) ? join(outputDir, 'recording.har') : undefined,
        crawler: {
            maxDepth: parseInt(options.maxDepth),
            maxPages: parseInt(options.maxPages),
            rateLimitMs: parseInt(options.rateLimit),
            sameDomain: options.sameDomainOnly,
        },
    };
    try {
        // Run scan
        console.log('🚀 Starting scan...\n');
        const results = await scanner.scan(config);
        // Display results
        console.log('\n📊 Scan Results');
        console.log('===============\n');
        console.log(`Pages scanned: ${results.summary.pagesScanned}`);
        console.log(`Total issues: ${results.summary.totalIssues}`);
        console.log(`Duration: ${results.summary.duration}`);
        console.log('');
        if (results.summary.totalIssues > 0) {
            console.log('Issues by severity:');
            for (const [severity, count] of Object.entries(results.summary.bySeverity)) {
                console.log(`  ${severity}: ${count}`);
            }
            console.log('');
            console.log('Issues by category:');
            for (const [category, count] of Object.entries(results.summary.byCategory)) {
                console.log(`  ${category}: ${count}`);
            }
            console.log('');
            // Show detailed issues
            console.log('Detailed issues:');
            for (const page of results.pages) {
                if (page.summary.totalIssues > 0) {
                    console.log(`\n  ${page.url}:`);
                    for (const detectorResult of page.detectorResults) {
                        for (const issue of detectorResult.issues) {
                            console.log(`    [${issue.severity}] ${issue.category}: ${issue.message}`);
                        }
                    }
                }
            }
        }
        // Save scan results to JSON
        const scanResultsPath = options.output && options.output.endsWith('.json')
            ? options.output
            : join(outputDir, `scan-results.json`);
        writeFileSync(scanResultsPath, JSON.stringify(results, null, 2));
        console.log(`\n💾 Results saved to: ${scanResultsPath}`);
        // Create bundle if requested
        if (options.bundle) {
            console.log('\n📦 Creating reproducible bundle...');
            const bundleResult = await createBundle({
                scanResults: results,
                outputDir,
                harPath: results.harPath,
            });
            console.log(`\n✅ Bundle created: ${bundleResult.bundlePath}`);
            console.log(`   Size: ${(bundleResult.size / 1024).toFixed(2)} KB`);
            console.log(`   Contents: ${bundleResult.contents.length} files`);
            console.log('');
            console.log('   To reproduce:');
            console.log(`   unzip ${bundleResult.bundlePath.split('/').pop()}`);
            console.log('   chmod +x reproduce.sh');
            console.log('   ./reproduce.sh');
        }
        // Exit with error code if issues found
        if (results.summary.totalIssues > 0) {
            process.exit(1);
        }
    }
    catch (error) {
        console.error('\n❌ Scan failed:', error);
        process.exit(1);
    }
});
//# sourceMappingURL=scan.js.map