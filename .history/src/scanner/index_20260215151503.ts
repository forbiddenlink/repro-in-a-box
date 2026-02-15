import { chromium, type Browser, type Page } from '@playwright/test';
import { DetectorRegistry, type DetectorResult } from '../detectors/index.js';
import { Crawler, type CrawlerConfig, type CrawledPage } from '../crawler/index.js';

/**
 * Configuration for scanner
 */
export interface ScanConfig {
  /** URL to start scanning from */
  url: string;
  /** Crawler configuration */
  crawler?: CrawlerConfig;
  /** Whether to run in headless mode */
  headless?: boolean;
  /** Output directory for results */
  outputDir?: string;
  /** Whether to capture screenshots on errors */
  screenshots?: boolean;
}

/**
 * Result from scanning a single page
 */
export interface PageScanResult {
  page: CrawledPage;
  detectors: DetectorResult[];
  error?: string;
}

/**
 * Complete scan result
 */
export interface ScanResult {
  config: ScanConfig;
  startTime: number;
  endTime: number;
  duration: number;
  pages: PageScanResult[];
  summary: {
    totalPages: number;
    totalIssues: number;
    issuesByCategory: Record<string, number>;
    issuesBySeverity: Record<string, number>;
  };
}

/**
 * Scanner that orchestrates crawling and detection
 */
export class Scanner {
  private registry: DetectorRegistry;
  private browser?: Browser;
  private page?: Page;
  
  constructor(registry: DetectorRegistry) {
    this.registry = registry;
  }
  
  /**
   * Initialize browser and page
   */
  private async init(headless: boolean = true): Promise<void> {
    this.browser = await chromium.launch({ headless });
    this.page = await this.browser.newPage();
  }
  
  /**
   * Cleanup browser resources
   */
  private async cleanup(): Promise<void> {
    if (this.page) {
      await this.page.close();
      this.page = undefined;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = undefined;
    }
  }
  
  /**
   * Scan a single page with all enabled detectors
   */
  private async scanPage(page: Page, crawledPage: CrawledPage): Promise<PageScanResult> {
    const detectors = this.registry.getEnabled();
    const results: DetectorResult[] = [];
    
    try {
      // Page is already navigated by crawler
      // Wait a bit for async errors to occur
      await page.waitForTimeout(1000);
      
      // Run scan hooks for active detection
      for (const detector of detectors) {
        if (detector.scan) {
          await detector.scan(page, this.registry.getConfig(detector.id));
        }
      }
      
      // Collect results from all detectors
      for (const detector of detectors) {
        const result = await detector.collect(page);
        results.push(result);
      }
      
      return {
        page: crawledPage,
        detectors: results,
      };
    } catch (error) {
      return {
        page: crawledPage,
        detectors: results,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  
  /**
   * Run a complete scan
   */
  async scan(config: ScanConfig): Promise<ScanResult> {
    const startTime = Date.now();
    const pages: PageScanResult[] = [];
    
    try {
      // Initialize browser
      await this.init(config.headless ?? true);
      
      if (!this.page) {
        throw new Error('Failed to initialize browser page');
      }
      
      // Setup all detectors once
      const detectors = this.registry.getEnabled();
      for (const detector of detectors) {
        await detector.setup?.(this.registry.getConfig(detector.id));
      }
      
      // Attach all detectors to the page once (before any navigation)
      for (const detector of detectors) {
        await detector.attach(this.page, this.registry.getConfig(detector.id));
      }
      
      // Create crawler
      const crawler = new Crawler(config.crawler);
      
      // Crawl and scan pages
      for await (const crawledPage of crawler.crawl(this.page, config.url)) {
        console.log(`📄 Scanning: ${crawledPage.url}`);
        
        // Scan the page
        const result = await this.scanPage(this.page, crawledPage);
        pages.push(result);
        
        // Log issues found
        const totalIssues = result.detectors.reduce((sum, d) => sum + d.issues.length, 0);
        if (totalIssues > 0) {
          console.log(`  ⚠️  Found ${totalIssues} issue(s)`);
        } else {
          console.log(`  ✅ No issues found`);
        }
      }
      
      // Cleanup detectors once
      for (const detector of detectors) {
        await detector.cleanup?.();
      }
      
      const endTime = Date.now();
      
      // Calculate summary
      const summary = this.calculateSummary(pages);
      
      return {
        config,
        startTime,
        endTime,
        duration: endTime - startTime,
        pages,
        summary,
      };
    } finally {
      await this.cleanup();
    }
  }
  
  /**
   * Calculate summary statistics
   */
  private calculateSummary(pages: PageScanResult[]) {
    let totalIssues = 0;
    const issuesByCategory: Record<string, number> = {};
    const issuesBySeverity: Record<string, number> = {};
    
    for (const pageResult of pages) {
      for (const detectorResult of pageResult.detectors) {
        for (const issue of detectorResult.issues) {
          totalIssues++;
          
          // Count by category
          issuesByCategory[issue.category] = (issuesByCategory[issue.category] || 0) + 1;
          
          // Count by severity
          issuesBySeverity[issue.severity] = (issuesBySeverity[issue.severity] || 0) + 1;
        }
      }
    }
    
    return {
      totalPages: pages.length,
      totalIssues,
      issuesByCategory,
      issuesBySeverity,
    };
  }
}
