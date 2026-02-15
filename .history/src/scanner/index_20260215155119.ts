import { chromium, type Browser, type Page, type BrowserContext } from '@playwright/test';
import { DetectorRegistry, type DetectorResult } from '../detectors/index.js';
import { Crawler, type CrawlerConfig, type CrawledPage } from '../crawler/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';

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
  /** Whether to record HAR file */
  recordHar?: boolean;
  /** Path to save HAR file */
  harPath?: string;
}

/**
 * Result from scanning a single page
 */
export interface PageScanResult {
  url: string;
  depth: number;
  detectorResults: DetectorResult[];
  summary: {
    totalIssues: number;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
  };
  screenshotPath?: string;
  harPath?: string;
  error?: string;
}

/**
 * Complete scan results (matches bundler interface)
 */
export interface ScanResults {
  timestamp: string;
  url: string;
  config: ScanConfig;
  pages: PageScanResult[];
  summary: {
    pagesScanned: number;
    totalIssues: number;
    duration: string;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
  };
  harPath?: string;
}

/**
 * Legacy ScanResult interface (deprecated, use ScanResults)
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
  private context?: BrowserContext;
  private page?: Page;
  private config?: ScanConfig;
  private screenshotCounter = 0;
  
  constructor(registry: DetectorRegistry) {
    this.registry = registry;
  }
  
  /**
   * Initialize browser and page
   */
  private async init(config: ScanConfig): Promise<void> {
    this.config = config;
    this.browser = await chromium.launch({ headless: config.headless ?? true });
    
    // Create context with HAR recording if enabled
    const contextOptions: any = {};
    
    if (config.recordHar && config.harPath) {
      // Ensure output directory exists
      const harDir = path.dirname(config.harPath);
      await fs.mkdir(harDir, { recursive: true });
      
      contextOptions.recordHar = {
        path: config.harPath,
        mode: 'minimal', // or 'full' for complete recording
      };
    }
    
    this.context = await this.browser.newContext(contextOptions);
    this.page = await this.context.newPage();
  }
  
  /**
   * Cleanup browser resources
   */
  private async cleanup(): Promise<void> {
    if (this.page) {
      await this.page.close();
      this.page = undefined;
    }
    if (this.context) {
      await this.context.close();
      this.context = undefined;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = undefined;
    }
  }
  
  /**
   * Capture screenshot if config.screenshots is enabled
   */
  private async captureScreenshot(page: Page, url: string): Promise<string | undefined> {
    if (!this.config?.screenshots || !this.config?.outputDir) {
      return undefined;
    }
    
    try {
      const screenshotsDir = path.join(this.config.outputDir, 'screenshots');
      await fs.mkdir(screenshotsDir, { recursive: true });
      
      // Sanitize URL for filename
      const sanitized = url
        .replace(/^https?:\/\//, '')
        .replace(/[^a-z0-9-]/gi, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 50);
      
      this.screenshotCounter++;
      const filename = `${this.screenshotCounter}-${sanitized}.png`;
      const screenshotPath = path.join(screenshotsDir, filename);
      
      await page.screenshot({ path: screenshotPath, fullPage: true });
      return screenshotPath;
    } catch (error) {
      console.warn(`⚠️  Failed to capture screenshot: ${error}`);
      return undefined;
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
