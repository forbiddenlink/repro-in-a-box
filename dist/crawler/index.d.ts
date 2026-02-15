import { type Page } from '@playwright/test';
/**
 * Configuration for crawler
 */
export interface CrawlerConfig {
    /** Maximum number of pages to crawl */
    maxPages?: number;
    /** Maximum depth to crawl (0 = only start URL) */
    maxDepth?: number;
    /** Delay between requests in milliseconds */
    rateLimitMs?: number;
    /** Whether to stay within the same domain */
    sameDomain?: boolean;
    /** URL patterns to include (regex strings) */
    includePatterns?: string[];
    /** URL patterns to exclude (regex strings) */
    excludePatterns?: string[];
}
/**
 * A crawled page result
 */
export interface CrawledPage {
    url: string;
    depth: number;
    statusCode: number;
    timestamp: number;
}
/**
 * Simple web crawler for multi-page scanning
 */
export declare class Crawler {
    private visited;
    private queue;
    private config;
    constructor(config?: CrawlerConfig);
    /**
     * Normalize a URL (remove fragment, trailing slash, etc.)
     */
    private normalizeUrl;
    /**
     * Check if URL should be crawled
     */
    private shouldCrawl;
    /**
     * Extract links from a page
     */
    private extractLinks;
    /**
     * Crawl a single page and extract links
     */
    crawlPage(page: Page, url: string, depth: number, onPage?: (result: CrawledPage) => Promise<void>): Promise<CrawledPage>;
    /**
     * Crawl starting from a URL
     */
    crawl(page: Page, startUrl: string): AsyncGenerator<CrawledPage, void, unknown>;
    /**
     * Get crawl statistics
     */
    getStats(): {
        visitedCount: number;
        queueSize: number;
        visited: string[];
    };
}
//# sourceMappingURL=index.d.ts.map