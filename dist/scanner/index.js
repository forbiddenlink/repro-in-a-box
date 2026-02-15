import { chromium } from '@playwright/test';
import { Crawler } from '../crawler/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';
/**
 * Scanner that orchestrates crawling and detection
 */
export class Scanner {
    registry;
    browser;
    context;
    page;
    config;
    screenshotCounter = 0;
    constructor(registry) {
        this.registry = registry;
    }
    /**
     * Initialize browser and page
     */
    async init(config) {
        this.config = config;
        this.browser = await chromium.launch({ headless: config.headless ?? true });
        // Create context with HAR recording if enabled
        const contextOptions = {};
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
    async cleanup() {
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
    async captureScreenshot(page, url) {
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
        }
        catch (error) {
            console.warn(`⚠️  Failed to capture screenshot: ${error}`);
            return undefined;
        }
    }
    /**
     * Scan a single page with all enabled detectors
     */
    async scanPage(page, crawledPage) {
        const detectors = this.registry.getEnabled();
        const detectorResults = [];
        let error;
        let screenshotPath;
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
                detectorResults.push(result);
            }
            // Calculate totals for this page
            let totalIssues = 0;
            const byCategory = {};
            const bySeverity = {};
            for (const result of detectorResults) {
                for (const issue of result.issues) {
                    totalIssues++;
                    byCategory[issue.category] = (byCategory[issue.category] || 0) + 1;
                    bySeverity[issue.severity] = (bySeverity[issue.severity] || 0) + 1;
                }
            }
            // Capture screenshot if issues were found and screenshots are enabled
            if (totalIssues > 0 && this.config?.screenshots) {
                screenshotPath = await this.captureScreenshot(page, crawledPage.url);
            }
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
        }
        catch (err) {
            error = err instanceof Error ? err.message : String(err);
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
    async scan(config) {
        const startTime = Date.now();
        const pages = [];
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
            // Create crawler
            const crawler = new Crawler(config.crawler);
            // Crawl and scan pages
            for await (const crawledPage of crawler.crawl(this.page, config.url)) {
                console.log(`📄 Scanning: ${crawledPage.url}`);
                // Scan the page
                const result = await this.scanPage(this.page, crawledPage);
                pages.push(result);
                // Log issues found
                if (result.summary.totalIssues > 0) {
                    console.log(`  ⚠️  Found ${result.summary.totalIssues} issue(s)`);
                }
                else {
                    console.log(`  ✅ No issues found`);
                }
            }
            // Cleanup detectors once
            for (const detector of detectors) {
                await detector.cleanup?.();
            }
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
        }
        finally {
            await this.cleanup();
        }
    }
    /**
     * Calculate summary statistics
     */
    calculateSummary(pages, duration) {
        let totalIssues = 0;
        const byCategory = {};
        const bySeverity = {};
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
//# sourceMappingURL=index.js.map