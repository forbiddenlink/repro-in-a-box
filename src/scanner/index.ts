import { chromium, type Browser, type Page, type BrowserContext } from '@playwright/test';
import { DetectorRegistry, type DetectorResult } from '../detectors/index.js';
import { Crawler, type CrawlerConfig, type CrawledPage } from '../crawler/index.js';
import { IssueCategory, IssueSeverity } from '../detectors/base.js';
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
  /** Deadline for the whole scan in ms. When hit, the browser is closed and partial results are returned. */
  scan?: number;
}

/** Close a browser handle without ever throwing or hanging; it may already be gone. */
const CLOSE_TIMEOUT_MS = 10_000;
/** A fresh context every few pages keeps one renderer from accumulating state until it dies. */
const PAGES_PER_CONTEXT = 3;

async function safeClose(closeFn: () => Promise<unknown>): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      closeFn(),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, CLOSE_TIMEOUT_MS);
        timer.unref?.();
      }),
    ]);
  } catch {
    // Target page, context or browser has been closed: nothing left to release
  } finally {
    if (timer) clearTimeout(timer);
  }
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
  /** Optional plugin lifecycle hooks */
  hooks?: {
    beforeScan?: (ctx: { url: string; registry: DetectorRegistry }) => Promise<void> | void;
    afterScan?: (ctx: { url: string; registry: DetectorRegistry; results: ScanResults }) => Promise<void> | void;
    onError?: (error: Error, ctx: { url: string; registry: DetectorRegistry }) => Promise<void> | void;
  };
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
  /** True when the scan hit its global deadline and results are partial */
  deadlineExceeded?: boolean;
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
  private contextOptions: { recordHar?: { path: string; mode: 'minimal' | 'full' } } = {};
  private pagesInContext = 0;
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
    interface ContextOptions {
      recordHar?: {
        path: string;
        mode: 'minimal' | 'full';
      };
    }
    const contextOptions: ContextOptions = {};

    if (config.recordHar && config.harPath) {
      // Ensure output directory exists
      const harDir = path.dirname(config.harPath);
      await fs.mkdir(harDir, { recursive: true });

      contextOptions.recordHar = {
        path: config.harPath,
        mode: 'minimal', // or 'full' for complete recording
      };
    }

    this.contextOptions = contextOptions;
    this.context = await this.browser.newContext(contextOptions);
    await this.openPage();
  }

  /**
   * Open a fresh page in the current context (or a fresh context if it is gone) and
   * configure it. Used at startup and to recover after a renderer crash.
   */
  private async openPage(): Promise<Page> {
    const config = this.config;
    if (!this.browser || !config) throw new Error('Browser is not initialized');
    try {
      this.page = await this.context!.newPage();
    } catch {
      this.context = await this.browser.newContext(this.contextOptions);
      this.page = await this.context.newPage();
    }
    this.pagesInContext = 0;

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
    return this.page;
  }

  /**
   * Replace the current page, and optionally its context, then re-attach detectors.
   * Detector state (collected issues) lives on the detector instances, so it survives.
   */
  private async recyclePage(newContext: boolean): Promise<void> {
    const oldPage = this.page;
    this.page = undefined;
    if (oldPage) await safeClose(() => oldPage.close());
    if (newContext && this.browser) {
      const oldContext = this.context;
      this.context = undefined;
      if (oldContext) await safeClose(() => oldContext.close());
      this.context = await this.browser.newContext(this.contextOptions);
    }
    const page = await this.openPage();
    for (const detector of this.registry.getEnabled()) {
      await detector.attach(page, this.registry.getConfig(detector.id));
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
    const { page, context, browser } = this;
    this.page = undefined;
    this.context = undefined;
    this.browser = undefined;
    if (page) await safeClose(() => page.close());
    if (context) await safeClose(() => context.close());
    if (browser) await safeClose(() => browser.close());
  }

  /** Synthetic result for a page whose renderer crashed, so the crash shows up as a finding */
  private crashedPageResult(crawledPage: CrawledPage): PageScanResult {
    const now = Date.now();
    const issue = {
      type: 'page-crash',
      message: `Page crashed while loading: ${crawledPage.error ?? 'renderer terminated'}`,
      severity: IssueSeverity.ERROR,
      category: IssueCategory.JAVASCRIPT,
      url: crawledPage.url,
      timestamp: now,
    };
    return {
      url: crawledPage.url,
      depth: crawledPage.depth,
      detectorResults: [{
        detector: 'scanner',
        url: crawledPage.url,
        startTime: now,
        endTime: now,
        duration: 0,
        issues: [issue],
      }],
      summary: {
        totalIssues: 1,
        byCategory: { [issue.category]: 1 },
        bySeverity: { [issue.severity]: 1 },
      },
    };
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
          localStorage.clear();
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
      // Report page scan completion even on error
      this.progress?.completePage(crawledPage.url);
      throw err;
    }
  }
  
  /**
   * Run a complete scan
   */
  async scan(config: ScanConfig): Promise<ScanResults> {
    const startTime = Date.now();
    const pages: PageScanResult[] = [];
    let deadlineExceeded = false;
    let deadlineTimer: NodeJS.Timeout | undefined;
    
    // Create progress reporter
    this.progress = createProgressReporter({
      format: config.progressFormat || 'simple',
      enabled: config.progressFormat !== 'minimal'
    });
    
    try {
      const hookCtx = { url: config.url, registry: this.registry };
      await config.hooks?.beforeScan?.(hookCtx);

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
      
      // Global deadline: closing the browser rejects whatever call is in flight, so a hung
      // page cannot hold the scan (and the CI job) open.
      if (config.timeouts?.scan && config.timeouts.scan > 0) {
        deadlineTimer = setTimeout(() => {
          deadlineExceeded = true;
          console.warn(`⚠️  Scan deadline of ${config.timeouts?.scan}ms reached, returning partial results`);
          const browser = this.browser;
          if (browser) void safeClose(() => browser.close());
        }, config.timeouts.scan);
        deadlineTimer.unref?.();
      }

      try {
        // Crawl and scan pages
        for await (const crawledPage of crawler.crawl(() => this.page as Page, config.url)) {
          if (deadlineExceeded) break;

          if (crawledPage.crashed) {
            console.log(`💥 Page crashed: ${crawledPage.url}`);
            pages.push(this.crashedPageResult(crawledPage));
            this.progress.foundIssue(IssueSeverity.ERROR, IssueCategory.JAVASCRIPT);
            await this.recyclePage(false);
            continue;
          }

          console.log(`📄 Scanning: ${crawledPage.url}`);

          // Scan the page
          const result = await this.scanPage(this.page as Page, crawledPage);
          pages.push(result);

          // Log issues found
          if (result.summary.totalIssues > 0) {
            console.log(`  ⚠️  Found ${result.summary.totalIssues} issue(s)`);
          } else {
            console.log(`  ✅ No issues found`);
          }

          // Start the next page in a fresh context so one renderer never serves the whole crawl.
          // Skipped while recording HAR, which is tied to the context.
          this.pagesInContext++;
          if (!config.recordHar && this.pagesInContext >= PAGES_PER_CONTEXT) {
            await this.recyclePage(true);
          }
        }
      } catch (error) {
        // Errors after the deadline are the browser being closed under us, not a scan failure
        if (!deadlineExceeded) throw error;
      } finally {
        // Cleanup detectors once
        for (const detector of detectors) {
          await detector.cleanup?.();
        }
      }
      
      // Report scan completion
      this.progress.complete();
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Calculate summary
      const summary = this.calculateSummary(pages, duration);
      
      const results: ScanResults = {
        timestamp: new Date(startTime).toISOString(),
        url: config.url,
        config,
        pages,
        summary,
        harPath: config.harPath,
        ...(deadlineExceeded ? { deadlineExceeded: true } : {}),
      };

      await config.hooks?.afterScan?.({ ...hookCtx, results });
      return results;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      try {
        await config.hooks?.onError?.(err, { url: config.url, registry: this.registry });
      } catch {
        // plugin onError must not mask the original failure
      }
      throw err;
    } finally {
      if (deadlineTimer) clearTimeout(deadlineTimer);
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
