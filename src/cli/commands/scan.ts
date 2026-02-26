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
  ConsoleWarningsDetector,
  SeoDetector,
} from '../../detectors/index.js';
import { Scanner, type ScanConfig } from '../../scanner/index.js';
import { createBundle, type BundleOptions } from '../../bundler/index.js';
import { loadConfig, mergeConfigs, DEFAULT_CONFIG, type ReproConfig, type FullReproConfig } from '../../config/index.js';
import { generateHtmlReport } from '../../reporters/html-reporter.js';
import { logger, createChildLogger } from '../../utils/logger.js';
import { ValidationError, handleError } from '../../utils/errors.js';

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
  .option('--nav-timeout <ms>', 'Navigation timeout in milliseconds (default: 30000)')
  .option('--action-timeout <ms>', 'Action timeout in milliseconds (default: 30000)')
  .option('--detection-timeout <ms>', 'Detection timeout in milliseconds (default: 30000)')
  .option('--block-images', 'Block image downloads for faster scanning')
  .option('--block-fonts', 'Block font downloads for faster scanning')
  .option('--block-media', 'Block media downloads (video/audio) for faster scanning')
  .option('--block-styles', 'Block stylesheet downloads for faster scanning')
  .option('--no-asset-blocking', 'Disable all asset blocking (default: blocking enabled)')
  .option('--progress <format>', 'Progress reporting format: simple, detailed, minimal (default: simple)')
  .option('-c, --config <path>', 'Path to config file')
  .option('--verbose', 'Verbose output')
  .action(async (url: string, options) => {
    // Configure logging
    logger.configure({ verbose: options.verbose === true });
    const scanLogger = createChildLogger({ url, command: 'scan' });

    try {
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
      
      scanLogger.info('🔍 Repro-in-a-Box Scanner', {
        url,
        maxDepth: config.crawler.maxDepth,
        maxPages: config.crawler.maxPages,
        rateLimit: config.crawler.rateLimit,
        headless: config.browser.headless,
        bundle: config.bundle.enabled
      });
      
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
        'console-warnings': new ConsoleWarningsDetector(),
        'seo': new SeoDetector(),
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
          scanLogger.debug(`Registered detector: ${id}`);
        }
      }
      
      scanLogger.info(`📦 Registered ${finalEnabledIds.length} detector(s)`, {
        detectors: finalEnabledIds
      });
      
      // Create scanner
      const scanner = new Scanner(registry);
      
      // Determine output directory
      const outputDir = options.output 
        ? (options.output.match(/\.(json|html)$/) ? join(options.output, '..') : options.output)
        : (config.output.path || process.cwd());
      
      // Ensure output directory exists
      mkdirSync(outputDir, { recursive: true });
      scanLogger.debug('Output directory created', { outputDir });
      
      // Configure scan with timeout options
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
        timeouts: {
          navigation: options.navTimeout ? parseInt(options.navTimeout) : undefined,
          action: options.actionTimeout ? parseInt(options.actionTimeout) : undefined,
          detection: options.detectionTimeout ? parseInt(options.detectionTimeout) : undefined,
        },
        assetBlocking: {
          enabled: options.assetBlocking !== false, // Default: enabled unless explicitly disabled
          blockImages: options.blockImages === true ? true : undefined, // Only set if explicitly enabled
          blockStylesheets: options.blockStyles === true ? true : undefined,
          blockFonts: options.blockFonts === true ? true : undefined,
          blockMedia: options.blockMedia === true ? true : undefined,
        },
        progressFormat: (options.progress || 'simple') as 'simple' | 'detailed' | 'minimal',
      };
      
      // Run scan
      scanLogger.info('🚀 Starting scan...');
      const end = scanLogger.time('Scan Complete', { url });
      const results = await scanner.scan(scanConfig);
      end();
      
      // Display results
      scanLogger.info('📊 Scan Results', {
        pagesScanned: results.summary.pagesScanned,
        totalIssues: results.summary.totalIssues,
        duration: results.summary.duration
      });
      
      if (results.summary.totalIssues > 0) {
        scanLogger.info('Issues by severity:', results.summary.bySeverity);
        scanLogger.info('Issues by category:', results.summary.byCategory);
        
        scanLogger.debug('Detailed issues:', {
          pages: results.pages.length,
          issues: results.pages.reduce((sum, p) => sum + p.summary.totalIssues, 0)
        });
      }
      
      // Save scan results
      const format = options.format || 'json';
      const extension = format === 'html' ? '.html' : '.json';
      const outputPath = options.output || join(outputDir, `scan-results${extension}`);
      
      if (format === 'html') {
        generateHtmlReport(results, outputPath);
        scanLogger.info(`💾 HTML report saved`, { path: outputPath });
      } else {
        writeFileSync(outputPath, JSON.stringify(results, null, 2));
        scanLogger.info(`💾 Results saved`, { path: outputPath });
      }
      
      // Create bundle if requested
      if (config.bundle.enabled) {
        scanLogger.info('📦 Creating reproducible bundle...');
        
        const bundleOptions: BundleOptions = {
          scanResults: results,
          outputDir,
          harPath: results.harPath,
        };
        
        const endBundle = scanLogger.time('Bundle creation');
        const bundleResult = await createBundle(bundleOptions);
        endBundle();
        
        scanLogger.info('✅ Bundle created', {
          path: bundleResult.bundlePath,
          size: `${(bundleResult.size / 1024).toFixed(2)} KB`,
          files: bundleResult.contents.length
        });
      }
      
      // Exit with error code if issues found
      if (results.summary.totalIssues > 0) {
        scanLogger.warn('Scan completed with issues', {
          issueCount: results.summary.totalIssues
        });
        process.exit(1);
      }
      
      scanLogger.info('✅ Scan completed successfully');
    } catch (error) {
      scanLogger.error('Scan failed', error instanceof Error ? error : new Error(String(error)));
      handleError(error);
    }
  });

