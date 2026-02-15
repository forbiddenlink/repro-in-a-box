import { chromium } from '@playwright/test';
import { Crawler } from '../crawler/index.js';
/**
 * Scanner that orchestrates crawling and detection
 */
export class Scanner {
    registry;
    browser;
    page;
    constructor(registry) {
        this.registry = registry;
    }
    /**
     * Initialize browser and page
     */
    async init(headless = true) {
        this.browser = await chromium.launch({ headless });
        this.page = await this.browser.newPage();
    }
    /**
     * Cleanup browser resources
     */
    async cleanup() {
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
    async scanPage(page, crawledPage) {
        const detectors = this.registry.getEnabled();
        const results = [];
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
        }
        catch (error) {
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
    async scan(config) {
        const startTime = Date.now();
        const pages = [];
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
        }
        finally {
            await this.cleanup();
        }
    }
    /**
     * Calculate summary statistics
     */
    calculateSummary(pages) {
        let totalIssues = 0;
        const issuesByCategory = {};
        const issuesBySeverity = {};
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
//# sourceMappingURL=index.js.map