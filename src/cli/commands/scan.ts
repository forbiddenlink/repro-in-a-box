import { Command } from 'commander';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  DetectorRegistry,
  JavaScriptErrorsDetector,
  NetworkErrorsDetector,
  BrokenAssetsDetector,
  AccessibilityDetector,
  WebVitalsDetector,
  MixedContentDetector,
  BrokenLinksDetector,
} from '../../detectors/index.js';
import { Scanner, type ScanConfig } from '../../scanner/index.js';
import { createBundle, type BundleOptions } from '../../bundler/index.js';
import { loadConfig, mergeConfigs, DEFAULT_CONFIG, type ReproConfig, type FullReproConfig } from '../../config/index.js';
import { generateHtmlReport } from '../../reporters/html-reporter.js';

export const scanCommand = new Command('scan')
  .description('Scan a website for issues')
  .argument('<url>', 'URL to scan')
  .option('-d, --max-depth <number>', 'Maximum crawl depth')
  .option('-p, --max-pages <number>', 'Maximum pages to scan')
  .option('-r, --rate-limit <ms>', 'Rate limit between requests')
  .option('-o, --output <path>', 'Output file path')
  .option('-f, --format <type>', 'Output format (json, html)', 'json')
  .option('--no-headless', 'Run browser in visible mode')
  .option('--same-domain-only', 'Only crawl pages on the same domain')
  .option('-b, --bundle', 'Create reproducible bundle (ZIP with HAR + screenshots)')
  .option('--screenshots', 'Capture screenshots when issues are detected')
  .option('--record-har', 'Record HAR file for replay')
  .option('-c, --config <path>', 'Path to config file')
  .option('--verbose', 'Verbose output')
  .action(async (url: string, options) => {
    // Load config from file (if exists)
    const fileConfig = await loadConfig({ configPath: options.config });
    
    // Build config from CLI options (only include explicitly set options)
    const cliConfig: Partial<ReproConfig> = {};
    
    if (options.maxDepth !== undefined) {
      cliConfig.crawler = { ...cliConfig.crawler, maxDepth: parseInt(options.maxDepth) };
    }
    if (options.maxPages !== undefined) {
      cliConfig.crawler = { ...cliConfig.crawler, maxPages: parseInt(options.maxPages) };
    }
    if (options.rateLimit !== undefined) {
      cliConfig.crawler = { ...cliConfig.crawler, rateLimit: parseInt(options.rateLimit) };
    }
    if (options.sameDomainOnly !== undefined) {
      cliConfig.crawler = { ...cliConfig.crawler, sameDomain: options.sameDomainOnly };
    }
    if (options.headless === false) { // Only if explicitly set to false
      cliConfig.browser = { ...cliConfig.browser, headless: false };
    }
    if (options.verbose !== undefined) {
      cliConfig.output = { ...cliConfig.output, verbose: options.verbose };
    }
    if (options.bundle !== undefined) {
      cliConfig.bundle = { ...cliConfig.bundle, enabled: options.bundle };
    }
    if (options.screenshots !== undefined) {
      cliConfig.bundle = { ...cliConfig.bundle, includeScreenshots: options.screenshots };
    }
    
    // Merge configs: CLI > file > defaults
    const config: FullReproConfig = mergeConfigs(fileConfig, cliConfig);
    
    console.log('🔍 Repro-in-a-Box Scanner');
    console.log('========================\n');
    console.log(`URL: ${url}`);
    console.log(`Max Depth: ${config.crawler.maxDepth}`);
    console.log(`Max Pages: ${config.crawler.maxPages}`);
    console.log(`Rate Limit: ${config.crawler.rateLimit}ms`);
    console.log(`Headless: ${config.browser.headless}`);
    if (config.bundle.enabled) {
      console.log(`Bundle: Yes (includes HAR + screenshots)`);
    }
    console.log('');
    
    // Create registry and register detectors
    const registry = new DetectorRegistry();
    
    // Map of all available detectors
    const allDetectors = {
      'javascript-errors': new JavaScriptErrorsDetector(),
      'network-errors': new NetworkErrorsDetector(),
      'broken-assets': new BrokenAssetsDetector(),
      'accessibility': new AccessibilityDetector(),
      'web-vitals': new WebVitalsDetector(),
      'mixed-content': new MixedContentDetector(),
      'broken-links': new BrokenLinksDetector(),
    };
    
    // Determine which detectors to enable
    const enabledDetectorIds = (config.detectors.enabled && config.detectors.enabled.length > 0)
      ? config.detectors.enabled
      : Object.keys(allDetectors); // Enable all if none specified
    
    // Filter out disabled detectors
    const finalEnabledIds = enabledDetectorIds.filter(
      id => !(config.detectors.disabled?.includes(id))
    );
    
    // Register enabled detectors
    for (const id of finalEnabledIds) {
      const detector = allDetectors[id as keyof typeof allDetectors];
      if (detector) {
        registry.register(detector);
      }
    }
    
    console.log('📦 Registered detectors:');
    for (const detector of registry.getEnabled()) {
      console.log(`  - ${detector.name} (${detector.id})`);
    }
    console.log('');
    
    // Create scanner
    const scanner = new Scanner(registry);
    
    // Determine output directory
    const outputDir = options.output 
      ? (options.output.match(/\.(json|html)$/) ? join(options.output, '..') : options.output)
      : (config.output.path || process.cwd());
    
    // Ensure output directory exists
    mkdirSync(outputDir, { recursive: true });
    
    // Configure scan
    const scanConfig: ScanConfig = {
      url,
      headless: config.browser.headless,
      outputDir,
      screenshots: config.bundle.enabled || config.bundle.includeScreenshots,
      recordHar: config.bundle.enabled || options.recordHar,
      harPath: (config.bundle.enabled || options.recordHar) ? join(outputDir, 'recording.har') : undefined,
      crawler: {
        maxDepth: config.crawler.maxDepth,
        maxPages: config.crawler.maxPages,
        rateLimitMs: config.crawler.rateLimit,
        sameDomain: config.crawler.sameDomain,
      },
    };
    
    try {
      // Run scan
      console.log('🚀 Starting scan...\n');
      const results = await scanner.scan(scanConfig);
      
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
      
      // Save scan results
      const format = options.format || 'json';
      const extension = format === 'html' ? '.html' : '.json';
      const outputPath = options.output || join(outputDir, `scan-results${extension}`);
      
      if (format === 'html') {
        generateHtmlReport(results, outputPath);
        console.log(`\n💾 HTML report saved to: ${outputPath}`);
      } else {
        writeFileSync(outputPath, JSON.stringify(results, null, 2));
        console.log(`\n💾 Results saved to: ${outputPath}`);
      }
      
      // Create bundle if requested
      if (config.bundle.enabled) {
        console.log('\n📦 Creating reproducible bundle...');
        
        const bundleOptions: BundleOptions = {
          scanResults: results,
          outputDir,
          harPath: results.harPath,
        };
        
        const bundleResult = await createBundle(bundleOptions);
        
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
    } catch (error) {
      console.error('\n❌ Scan failed:', error);
      process.exit(1);
    }
  });

