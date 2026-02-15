/**
 * Simple web crawler for multi-page scanning
 */
export class Crawler {
    visited = new Set();
    queue = [];
    config;
    constructor(config = {}) {
        this.config = {
            maxPages: config.maxPages ?? 10,
            maxDepth: config.maxDepth ?? 2,
            rateLimitMs: config.rateLimitMs ?? 1000,
            sameDomain: config.sameDomain ?? true,
            includePatterns: config.includePatterns ?? [],
            excludePatterns: config.excludePatterns ?? [
                '\\.(pdf|zip|gz|tar|jpg|jpeg|png|gif|svg|ico|woff|woff2|ttf|eot)$',
                '#',
                'mailto:',
                'tel:',
                'javascript:',
            ],
        };
    }
    /**
     * Normalize a URL (remove fragment, trailing slash, etc.)
     */
    normalizeUrl(url) {
        try {
            const parsed = new URL(url);
            // Remove fragment
            parsed.hash = '';
            // Remove trailing slash (except for root)
            if (parsed.pathname !== '/') {
                parsed.pathname = parsed.pathname.replace(/\/$/, '');
            }
            return parsed.href;
        }
        catch {
            return url;
        }
    }
    /**
     * Check if URL should be crawled
     */
    shouldCrawl(url, baseUrl, depth) {
        // Check depth limit
        if (depth > this.config.maxDepth) {
            return false;
        }
        // Check max pages limit
        if (this.visited.size >= this.config.maxPages) {
            return false;
        }
        // Normalize URL
        const normalized = this.normalizeUrl(url);
        // Check if already visited
        if (this.visited.has(normalized)) {
            return false;
        }
        try {
            const urlObj = new URL(normalized);
            const baseObj = new URL(baseUrl);
            // Check same domain if required
            if (this.config.sameDomain && urlObj.hostname !== baseObj.hostname) {
                return false;
            }
            // Check exclude patterns
            for (const pattern of this.config.excludePatterns) {
                if (new RegExp(pattern, 'i').test(normalized)) {
                    return false;
                }
            }
            // Check include patterns (if any)
            if (this.config.includePatterns.length > 0) {
                let matches = false;
                for (const pattern of this.config.includePatterns) {
                    if (new RegExp(pattern, 'i').test(normalized)) {
                        matches = true;
                        break;
                    }
                }
                if (!matches) {
                    return false;
                }
            }
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Extract links from a page
     */
    async extractLinks(page) {
        return await page.evaluate(() => {
            const links = Array.from(globalThis.document.querySelectorAll('a[href]'));
            return links
                .map((link) => link.href)
                .filter((href) => href && href.trim() !== '');
        });
    }
    /**
     * Crawl a single page and extract links
     */
    async crawlPage(page, url, depth, onPage) {
        const normalized = this.normalizeUrl(url);
        this.visited.add(normalized);
        // Navigate to the page
        const response = await page.goto(normalized, {
            waitUntil: 'networkidle',
            timeout: 30000
        });
        const statusCode = response?.status() ?? 0;
        const timestamp = Date.now();
        const result = {
            url: normalized,
            depth,
            statusCode,
            timestamp,
        };
        // Call the onPage callback if provided
        if (onPage) {
            await onPage(result);
        }
        // Extract links if we haven't reached max depth
        if (depth < this.config.maxDepth) {
            const links = await this.extractLinks(page);
            // Add links to queue
            for (const link of links) {
                if (this.shouldCrawl(link, url, depth + 1)) {
                    this.queue.push({ url: link, depth: depth + 1 });
                }
            }
        }
        return result;
    }
    /**
     * Crawl starting from a URL
     */
    async *crawl(page, startUrl) {
        // Reset state
        this.visited.clear();
        this.queue = [{ url: startUrl, depth: 0 }];
        while (this.queue.length > 0 && this.visited.size < this.config.maxPages) {
            const { url, depth } = this.queue.shift();
            // Skip if already visited (could have been added multiple times)
            if (this.visited.has(this.normalizeUrl(url))) {
                continue;
            }
            // Rate limiting
            if (this.visited.size > 0) {
                await new Promise(resolve => setTimeout(resolve, this.config.rateLimitMs));
            }
            // Crawl the page
            try {
                const result = await this.crawlPage(page, url, depth);
                yield result;
            }
            catch (error) {
                console.error(`Failed to crawl ${url}:`, error);
                // Mark as visited to avoid retrying
                this.visited.add(this.normalizeUrl(url));
            }
        }
    }
    /**
     * Get crawl statistics
     */
    getStats() {
        return {
            visitedCount: this.visited.size,
            queueSize: this.queue.length,
            visited: Array.from(this.visited),
        };
    }
}
//# sourceMappingURL=index.js.map