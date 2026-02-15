import { DetectorRegistry, type DetectorResult } from '../detectors/index.js';
import { type CrawlerConfig } from '../crawler/index.js';
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
export declare class Scanner {
    private registry;
    private browser?;
    private context?;
    private page?;
    private config?;
    private screenshotCounter;
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
     * Capture screenshot if config.screenshots is enabled
     */
    private captureScreenshot;
    /**
     * Scan a single page with all enabled detectors
     */
    private scanPage;
    /**
     * Run a complete scan
     */
    scan(config: ScanConfig): Promise<ScanResults>;
    /**
     * Calculate summary statistics
     */
    private calculateSummary;
}
//# sourceMappingURL=index.d.ts.map