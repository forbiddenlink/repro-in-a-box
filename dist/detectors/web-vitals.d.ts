import type { Page } from '@playwright/test';
import { BaseDetector, IssueCategory, type DetectorConfig, type Issue } from './base.js';
/**
 * Web Vitals metrics
 */
interface WebVitalsMetric {
    name: 'CLS' | 'INP' | 'LCP' | 'FCP' | 'TTFB';
    value: number;
    rating: 'good' | 'needs-improvement' | 'poor';
    delta: number;
    id: string;
}
/**
 * Detector for Core Web Vitals (CLS, INP, LCP) using web-vitals library
 */
export declare class WebVitalsDetector extends BaseDetector {
    readonly id = "web-vitals";
    readonly name = "Web Vitals";
    readonly description = "Measures Core Web Vitals: CLS, INP, LCP";
    readonly category = IssueCategory.PERFORMANCE;
    private metrics;
    attach(page: Page, _config?: DetectorConfig): Promise<void>;
    scan(page: Page, _config?: DetectorConfig): Promise<Issue[]>;
    /**
     * Get thresholds for each metric
     */
    private getThresholds;
    /**
     * Get collected metrics
     */
    getMetrics(): WebVitalsMetric[];
}
export {};
//# sourceMappingURL=web-vitals.d.ts.map