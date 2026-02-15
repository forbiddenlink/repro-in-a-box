import type { Page } from '@playwright/test';
import { BaseDetector, IssueCategory, IssueSeverity, type DetectorConfig, type Issue } from './base.js';

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
export class WebVitalsDetector extends BaseDetector {
  readonly id = 'web-vitals';
  readonly name = 'Web Vitals';
  readonly description = 'Measures Core Web Vitals: CLS, INP, LCP';
  readonly category = IssueCategory.PERFORMANCE;
  
  private metrics: WebVitalsMetric[] = [];
  
  async attach(page: Page, _config?: DetectorConfig): Promise<void> {
    // Inject web-vitals library and setup metric collection
    await page.addInitScript(() => {
      // Store metrics in window object
      (globalThis as any).__webVitalsMetrics = [];
      
      // This will be replaced with actual web-vitals library code
      // For now, we'll collect it in the scan phase
    });
  }
  
  async scan(page: Page, _config?: DetectorConfig): Promise<Issue[]> {
    try {
      // Inject and run web-vitals library
      const metrics = await page.evaluate(async () => {
        // Import web-vitals from CDN
        const module = await import('https://unpkg.com/web-vitals@4?module');
        
        const collectedMetrics: any[] = [];
        
        // Collect CLS (Cumulative Layout Shift)
        module.onCLS((metric: any) => {
          collectedMetrics.push({
            name: 'CLS',
            value: metric.value,
            rating: metric.rating,
            delta: metric.delta,
            id: metric.id
          });
        });
        
        // Collect INP (Interaction to Next Paint)
        module.onINP((metric: any) => {
          collectedMetrics.push({
            name: 'INP',
            value: metric.value,
            rating: metric.rating,
            delta: metric.delta,
            id: metric.id
          });
        });
        
        // Collect LCP (Largest Contentful Paint)
        module.onLCP((metric: any) => {
          collectedMetrics.push({
            name: 'LCP',
            value: metric.value,
            rating: metric.rating,
            delta: metric.delta,
            id: metric.id
          });
        });
        
        // Collect FCP (First Contentful Paint)
        module.onFCP((metric: any) => {
          collectedMetrics.push({
            name: 'FCP',
            value: metric.value,
            rating: metric.rating,
            delta: metric.delta,
            id: metric.id
          });
        });
        
        // Collect TTFB (Time to First Byte)
        module.onTTFB((metric: any) => {
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
      
      this.metrics = metrics as WebVitalsMetric[];
      
      // Convert poor-rated metrics to issues
      for (const metric of this.metrics) {
        if (metric.rating === 'poor') {
          this.addIssue(
            this.createIssue(
              `web-vitals-${metric.name.toLowerCase()}`,
              `Poor ${metric.name}: ${metric.value.toFixed(2)} (threshold exceeded)`,
              IssueSeverity.WARNING,
              page.url(),
              {
                details: JSON.stringify({
                  metric: metric.name,
                  value: metric.value,
                  rating: metric.rating,
                  thresholds: this.getThresholds(metric.name)
                }, null, 2)
              }
            )
          );
        } else if (metric.rating === 'needs-improvement') {
          this.addIssue(
            this.createIssue(
              `web-vitals-${metric.name.toLowerCase()}`,
              `${metric.name} needs improvement: ${metric.value.toFixed(2)}`,
              IssueSeverity.INFO,
              page.url(),
              {
                details: JSON.stringify({
                  metric: metric.name,
                  value: metric.value,
                  rating: metric.rating,
                  thresholds: this.getThresholds(metric.name)
                }, null, 2)
              }
            )
          );
        }
      }
      
      return this.issues;
    } catch (error) {
      console.error('Failed to collect Web Vitals:', error);
      return [];
    }
  }
  
  /**
   * Get thresholds for each metric
   */
  private getThresholds(metric: string) {
    const thresholds: Record<string, { good: number; poor: number }> = {
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
  getMetrics(): WebVitalsMetric[] {
    return this.metrics;
  }
}
