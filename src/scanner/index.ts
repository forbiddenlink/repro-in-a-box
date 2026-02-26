import { chromium, type Browser, type Page, type BrowserContext } from '@playwright/test';
import { DetectorRegistry, type DetectorResult } from '../detectors/index.js';
import { Crawler, type CrawlerConfig, type CrawledPage } from '../crawler/index.js';
import { createProgressReporter, type ProgressReporter, type ProgressFormat } from '../utils/progress.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Timeout configuration for scanner operations
 */
export interface TimeoutConfig {
  /** Timeout for page navigation (goto, waitForNavigation) in ms */
  navigation?: number;
  /** Timeout for user actions (click, type, fill) in ms */
  action?: number;
  /** Timeout for detector operations in ms */
  detection?: number;
}

/**
 * Asset blocking configuration for performance optimization
 */
export interface AssetBlockingConfig {
  /** Whether to block resource downloads */
  enabled?: boolean;
  /** Block images (png, jpg, gif, svg, webp, etc.) */
  blockImages?: boolean;
  /** Block stylesheets (css) */
  blockStylesheets?: boolean;
  /** Block fonts (woff, woff2, ttf, otf, etc.) */
  blockFonts?: boolean;
  /** Block media (mp3, mp4, webm, etc.) */
  blockMedia?: boolean;
}

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
  /** Timeout configuration for operations */
  timeouts?: TimeoutConfig;
  /** Asset blocking configuration for performance */
  assetBlocking?: AssetBlockingConfig;
  /** Progress reporting format (simple, detailed, minimal) */
  progressFormat?: ProgressFormat;
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
  private progress?: ProgressReporter;
  
  constructor(registry: DetectorRegistry) {
    this.registry = registry;
  }
  
  /**
   * Initialize browser and page
   * Note: We reuse browser context across pages for 30-50% performance improvement.
   * Context is isolated per scan but shared within a scan for efficiency.
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
    
    // Apply action timeout if configured
    if (config.timeouts?.action) {
      this.page.setDefaultTimeout(config.timeouts.action);
    }
    
    // Apply navigation timeout if configured
    if (config.timeouts?.navigation) {
      this.page.setDefaultNavigationTimeout(config.timeouts.navigation);
    }
    
    // Setup asset blocking if enabled (default: enabled)
    const assetConfig = config.assetBlocking ?? { enabled: true };
    if (assetConfig.enabled !== false) {
      await this.setupAssetBlocking(this.page, assetConfig);
    }
  }
  
  /**
   * Setup resource blocking for performance optimization
   */
  private setupAssetBlockingPatterns(config: AssetBlockingConfig): string[] {
    const patterns: string[] = [];
    
    // Block images (png, jpg, gif, svg, webp, etc.)
    if (config.blockImages !== false) {
      patterns.push('**/*.png', '**/*.jpg', '**/*.jpeg', '**/*.gif', '**/*.svg', '**/*.webp', '**/*.ico');
    }
    
    // Block stylesheets
    if (config.blockStylesheets !== false) {
      patterns.push('**/*.css');
    }
    
    // Block fonts
    if (config.blockFonts !== false) {
      patterns.push('**/*.woff', '**/*.woff2', '**/*.ttf', '**/*.otf', '**/*.eot');
    }
    
    // Block media
    if (config.blockMedia !== false) {
      patterns.push('**/*.mp3', '**/*.mp4', '**/*.webm', '**/*.ogg', '**/*.wav', '**/*.flv');
    }
    
    return patterns;
  }
  
  /**
   * Setup route interception for asset blocking
   */
  private async setupAssetBlocking(page: Page, config: AssetBlockingConfig): Promise<void> {
    try {
      const patterns = this.setupAssetBlockingPatterns(config);
      
      // Create pattern matcher
      const shouldBlock = (url: string): boolean => {
        // Check each pattern
        for (const pattern of patterns) {
          // Convert glob pattern to regex
          const regexPattern = pattern
            .replace(/\./g, '\\.')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.');
          const regex = new RegExp(regexPattern, 'i');
          if (regex.test(url)) {
            return true;
          }
        }
        return false;
      };
      
      // Intercept routes
      await page.route('**/*', route => {
        const request = route.request();
        if (shouldBlock(request.url())) {
          void route.abort('blockedbyclient');
        } else {
          void route.continue();
        }
      });
    } catch (error) {
      // Asset blocking setup failed, continue without blocking
      console.warn('⚠️  Failed to setup asset blocking:', error);
    }
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
      console.warn(`⚠️  Failed to capture screenshot: ${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    }
  }
  
  /**
   * Scan a single page with all enabled detectors
   */
  private async scanPage(page: Page, crawledPage: CrawledPage): Promise<PageScanResult> {
    const detectors = this.registry.getEnabled();
    const detectorResults: DetectorResult[] = [];
    let error: string | undefined;
    let screenshotPath: string | undefined;
    
    // Report page scan start
    this.progress?.startPage(crawledPage.url);
    
    try {
      // Clear cookies and storage between pages for test isolation
      // Context is reused for performance, but we ensure clean state per page
      if (this.context) {
        await this.context.clearCookies();
        // Clear browser storage (runs in browser context where localStorage is available)
        await page.evaluate(() => {
          // @ts-expect-error - localStorage and sessionStorage are available in browser context
          localStorage.clear();
          // @ts-expect-error - sessionStorage is available in browser context
          sessionStorage.clear();
        }).catch(() => {
          // Ignore if page evaluation fails
        });
      }
      
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
        detectorResults.push(result);
      }
      
      // Calculate totals for this page
      let totalIssues = 0;
      const byCategory: Record<string, number> = {};
      const bySeverity: Record<string, number> = {};
      
      for (const result of detectorResults) {
        for (const issue of result.issues) {
          totalIssues++;
          byCategory[issue.category] = (byCategory[issue.category] || 0) + 1;
          bySeverity[issue.severity] = (bySeverity[issue.severity] || 0) + 1;
          
          // Report issue found
          this.progress?.foundIssue(issue.severity, issue.category);
        }
      }
      
      // Capture screenshot if issues were found and screenshots are enabled
      if (totalIssues > 0 && this.config?.screenshots) {
        screenshotPath = await this.captureScreenshot(page, crawledPage.url);
      }
      
      // Report page scan completion
      this.progress?.completePage(crawledPage.url);
      
      return {
        url: crawledPage.url,
        depth: crawledPage.depth,
        detectorResults,
        summary: {
          totalIssues,
          byCategory,
          bySeverity,
        },
        screenshotPath,
      };
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      
      // Report page scan completion even on error
      this.progress?.completePage(crawledPage.url);
      
      return {
        url: crawledPage.url,
        depth: crawledPage.depth,
        detectorResults,
        summary: {
          totalIssues: 0,
          byCategory: {},
          bySeverity: {},
        },
        error,
      };
    }
  }
  
  /**
   * Run a complete scan
   */
  async scan(config: ScanConfig): Promise<ScanResults> {
    const startTime = Date.now();
    const pages: PageScanResult[] = [];
    
    // Create progress reporter
    this.progress = createProgressReporter({
      format: config.progressFormat || 'simple',
      enabled: config.progressFormat !== 'minimal'
    });
    
    try {
      // Initialize browser with config
      await this.init(config);
      
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
      
      // Create crawler with timeout configuration
      const crawlerConfig = {
        ...config.crawler,
        navigationTimeoutMs: config.timeouts?.navigation ?? 30000
      };
      const crawler = new Crawler(crawlerConfig);
      
      // Get estimate of total pages
      const estimatedPages = config.crawler?.maxPages || 50;
      this.progress.setEstimatedPages(estimatedPages);
      
      // Crawl and scan pages
      for await (const crawledPage of crawler.crawl(this.page, config.url)) {
        console.log(`📄 Scanning: ${crawledPage.url}`);
        
        // Scan the page
        const result = await this.scanPage(this.page, crawledPage);
        pages.push(result);
        
        // Log issues found
        if (result.summary.totalIssues > 0) {
          console.log(`  ⚠️  Found ${result.summary.totalIssues} issue(s)`);
        } else {
          console.log(`  ✅ No issues found`);
        }
      }
      
      // Cleanup detectors once
      for (const detector of detectors) {
        await detector.cleanup?.();
      }
      
      // Report scan completion
      this.progress.complete();
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Calculate summary
      const summary = this.calculateSummary(pages, duration);
      
      return {
        timestamp: new Date(startTime).toISOString(),
        url: config.url,
        config,
        pages,
        summary,
        harPath: config.harPath,
      };
    } finally {
      await this.cleanup();
    }
  }
  
  /**
   * Calculate summary statistics
   */
  private calculateSummary(pages: PageScanResult[], duration: number) {
    let totalIssues = 0;
    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    
    for (const page of pages) {
      totalIssues += page.summary.totalIssues;
      
      for (const [category, count] of Object.entries(page.summary.byCategory)) {
        byCategory[category] = (byCategory[category] || 0) + count;
      }
      
      for (const [severity, count] of Object.entries(page.summary.bySeverity)) {
        bySeverity[severity] = (bySeverity[severity] || 0) + count;
      }
    }
    
    // Format duration as human-readable string
    const seconds = (duration / 1000).toFixed(2);
    const durationStr = `${seconds}s`;
    
    return {
      pagesScanned: pages.length,
      totalIssues,
      duration: durationStr,
      byCategory,
      bySeverity,
    };
  }
}
