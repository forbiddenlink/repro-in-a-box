import { DetectorRegistry, type DetectorResult } from '../detectors/index.js';
import { type CrawlerConfig, type CrawledPage } from '../crawler/index.js';
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
export declare class Scanner {
    private registry;
    private browser?;
    private page?;
    constructor(registry: DetectorRegistry);
    /**
     * Initialize browser and page
     */
    private init;
    /**
     * Cleanup browser resources
     */
    private cleanup;
    /**
     * Scan a single page with all enabled detectors
     */
    private scanPage;
    /**
     * Run a complete scan
     */
    scan(config: ScanConfig): Promise<ScanResult>;
    /**
     * Calculate summary statistics
     */
    private calculateSummary;
}
//# sourceMappingURL=index.d.ts.map