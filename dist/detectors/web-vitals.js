import { BaseDetector, IssueCategory, IssueSeverity } from './base.js';
/**
 * Detector for Core Web Vitals (CLS, INP, LCP) using web-vitals library
 */
export class WebVitalsDetector extends BaseDetector {
    id = 'web-vitals';
    name = 'Web Vitals';
    description = 'Measures Core Web Vitals: CLS, INP, LCP';
    category = IssueCategory.PERFORMANCE;
    metrics = [];
    async attach(page, _config) {
        // Inject web-vitals library and setup metric collection
        await page.addInitScript(() => {
            // Store metrics in window object
            globalThis.__webVitalsMetrics = [];
            // This will be replaced with actual web-vitals library code
            // For now, we'll collect it in the scan phase
        });
    }
    async scan(page, _config) {
        try {
            // Inject and run web-vitals library
            const metrics = await page.evaluate(async () => {
                // Import web-vitals from CDN
                // @ts-expect-error - Dynamic import from CDN
                const module = await import('https://unpkg.com/web-vitals@4?module');
                const collectedMetrics = [];
                // Collect CLS (Cumulative Layout Shift)
                module.onCLS((metric) => {
                    collectedMetrics.push({
                        name: 'CLS',
                        value: metric.value,
                        rating: metric.rating,
                        delta: metric.delta,
                        id: metric.id
                    });
                });
                // Collect INP (Interaction to Next Paint)
                module.onINP((metric) => {
                    collectedMetrics.push({
                        name: 'INP',
                        value: metric.value,
                        rating: metric.rating,
                        delta: metric.delta,
                        id: metric.id
                    });
                });
                // Collect LCP (Largest Contentful Paint)
                module.onLCP((metric) => {
                    collectedMetrics.push({
                        name: 'LCP',
                        value: metric.value,
                        rating: metric.rating,
                        delta: metric.delta,
                        id: metric.id
                    });
                });
                // Collect FCP (First Contentful Paint)
                module.onFCP((metric) => {
                    collectedMetrics.push({
                        name: 'FCP',
                        value: metric.value,
                        rating: metric.rating,
                        delta: metric.delta,
                        id: metric.id
                    });
                });
                // Collect TTFB (Time to First Byte)
                module.onTTFB((metric) => {
                    collectedMetrics.push({
                        name: 'TTFB',
                        value: metric.value,
                        rating: metric.rating,
                        delta: metric.delta,
                        id: metric.id
                    });
                });
                // Wait a bit for metrics to be collected
                await new Promise(resolve => setTimeout(resolve, 500));
                return collectedMetrics;
            });
            this.metrics = metrics;
            // Convert poor-rated metrics to issues
            for (const metric of this.metrics) {
                if (metric.rating === 'poor') {
                    this.addIssue(this.createIssue(`web-vitals-${metric.name.toLowerCase()}`, `Poor ${metric.name}: ${metric.value.toFixed(2)} (threshold exceeded)`, IssueSeverity.WARNING, page.url(), {
                        details: JSON.stringify({
                            metric: metric.name,
                            value: metric.value,
                            rating: metric.rating,
                            thresholds: this.getThresholds(metric.name)
                        }, null, 2)
                    }));
                }
                else if (metric.rating === 'needs-improvement') {
                    this.addIssue(this.createIssue(`web-vitals-${metric.name.toLowerCase()}`, `${metric.name} needs improvement: ${metric.value.toFixed(2)}`, IssueSeverity.INFO, page.url(), {
                        details: JSON.stringify({
                            metric: metric.name,
                            value: metric.value,
                            rating: metric.rating,
                            thresholds: this.getThresholds(metric.name)
                        }, null, 2)
                    }));
                }
            }
            return this.issues;
        }
        catch (error) {
            console.error('Failed to collect Web Vitals:', error);
            return [];
        }
    }
    /**
     * Get thresholds for each metric
     */
    getThresholds(metric) {
        const thresholds = {
            CLS: { good: 0.1, poor: 0.25 },
            INP: { good: 200, poor: 500 },
            LCP: { good: 2500, poor: 4000 },
            FCP: { good: 1800, poor: 3000 },
            TTFB: { good: 800, poor: 1800 }
        };
        return thresholds[metric] || { good: 0, poor: 0 };
    }
    /**
     * Get collected metrics
     */
    getMetrics() {
        return this.metrics;
    }
}
//# sourceMappingURL=web-vitals.js.map