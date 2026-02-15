import { Command } from 'commander';
import { writeFileSync } from 'fs';
import { join } from 'path';
import {
  DetectorRegistry,
  JavaScriptErrorsDetector,
  NetworkErrorsDetector,
  BrokenAssetsDetector,
} from '../../detectors/index.js';
import { Scanner, type ScanConfig } from '../../scanner/index.js';

export const scanCommand = new Command('scan')
  .description('Scan a website for issues')
  .argument('<url>', 'URL to scan')
  .option('-d, --max-depth <number>', 'Maximum crawl depth', '2')
  .option('-p, --max-pages <number>', 'Maximum pages to scan', '10')
  .option('-r, --rate-limit <ms>', 'Rate limit between requests', '1000')
  .option('-o, --output <path>', 'Output file path (JSON)')
  .option('--no-headless', 'Run browser in visible mode')
  .option('--same-domain-only', 'Only crawl pages on the same domain', true)
  .action(async (url: string, options) => {
    console.log('🔍 Repro-in-a-Box Scanner');
    console.log('========================\n');
    console.log(`URL: ${url}`);
    console.log(`Max Depth: ${options.maxDepth}`);
    console.log(`Max Pages: ${options.maxPages}`);
    console.log(`Rate Limit: ${options.rateLimit}ms`);
    console.log(`Headless: ${options.headless}`);
    console.log('');
    
    // Create registry and register detectors
    const registry = new DetectorRegistry();
    registry.register(new JavaScriptErrorsDetector());
    registry.register(new NetworkErrorsDetector());
    registry.register(new BrokenAssetsDetector());
    
    console.log('📦 Registered detectors:');
    for (const detector of registry.getEnabled()) {
      console.log(`  - ${detector.name} (${detector.id})`);
    }
    console.log('');
    
    // Create scanner
    const scanner = new Scanner(registry);
    
    // Configure scan
    const config: ScanConfig = {
      url,
      headless: options.headless,
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
      const result = await scanner.scan(config);
      
      // Display results
      console.log('\n📊 Scan Results');
      console.log('===============\n');
      console.log(`Pages scanned: ${result.summary.totalPages}`);
      console.log(`Total issues: ${result.summary.totalIssues}`);
      console.log(`Duration: ${(result.duration / 1000).toFixed(2)}s`);
      console.log('');
      
      if (result.summary.totalIssues > 0) {
        console.log('Issues by severity:');
        for (const [severity, count] of Object.entries(result.summary.issuesBySeverity)) {
          console.log(`  ${severity}: ${count}`);
        }
        console.log('');
        
        console.log('Issues by category:');
        for (const [category, count] of Object.entries(result.summary.issuesByCategory)) {
          console.log(`  ${category}: ${count}`);
        }
        console.log('');
        
        // Show detailed issues
        console.log('Detailed issues:');
        for (const pageResult of result.pages) {
          const pageIssues = pageResult.detectors.flatMap(d => d.issues);
          if (pageIssues.length > 0) {
            console.log(`\n  ${pageResult.page.url}:`);
            for (const issue of pageIssues) {
              console.log(`    [${issue.severity}] ${issue.category}: ${issue.message}`);
            }
          }
        }
      }
      
      // Save to file if output path specified
      if (options.output) {
        const outputPath = options.output.endsWith('.json') 
          ? options.output 
          : join(options.output, `scan-${Date.now()}.json`);
        
        writeFileSync(outputPath, JSON.stringify(result, null, 2));
        console.log(`\n💾 Results saved to: ${outputPath}`);
      }
      
      // Exit with error code if issues found
      if (result.summary.totalIssues > 0) {
        process.exit(1);
      }
    } catch (error) {
      console.error('\n❌ Scan failed:', error);
      process.exit(1);
    }
  });
