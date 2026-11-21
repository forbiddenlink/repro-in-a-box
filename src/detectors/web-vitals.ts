import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { Page } from '@playwright/test';
import { BaseDetector, IssueCategory, IssueSeverity, type DetectorConfig, type Issue } from './base.js';

type MetricCallback = (metric: Omit<WebVitalsMetric, 'name'>) => void;

interface WebVitalsLib {
  onCLS(cb: MetricCallback, opts?: { reportAllChanges?: boolean }): void;
  onINP(cb: MetricCallback, opts?: { reportAllChanges?: boolean }): void;
  onLCP(cb: MetricCallback, opts?: { reportAllChanges?: boolean }): void;
  onFCP(cb: MetricCallback): void;
  onTTFB(cb: MetricCallback): void;
}

// The web-vitals IIFE bundle assigns its API to a global we copy onto window.
declare global {
  interface Window {
    __reproWebVitals?: WebVitalsLib;
  }
}

const require = createRequire(import.meta.url);
let webVitalsSource: string | undefined;

/** Read the web-vitals IIFE bundle shipped in node_modules (no network fetch). */
async function loadWebVitalsSource(): Promise<string> {
  if (webVitalsSource === undefined) {
    const entry = require.resolve('web-vitals');
    webVitalsSource = await readFile(join(dirname(entry), 'web-vitals.iife.js'), 'utf8');
  }
  return webVitalsSource;
}

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
  
  async attach(_page: Page, _config?: DetectorConfig): Promise<void> {
    // No setup needed - web-vitals will be injected on each scan
  }

  async scan(page: Page, _config?: DetectorConfig): Promise<Issue[]> {
    try {
      // Load the bundled web-vitals IIFE through the debugging protocol instead of a
      // <script> tag. A script tag (inline or from a CDN) is blocked by any page whose
      // Content-Security-Policy restricts script-src, which turned every scan of such a
      // site into a CSP violation and returned no metrics. page.evaluate of a string is
      // not subject to the page's CSP.
      await page.evaluate(`${await loadWebVitalsSource()}\nwindow.__reproWebVitals = webVitals;`);

      const metrics = await page.evaluate(() => {
        return new Promise<WebVitalsMetric[]>((resolve) => {
          const lib = window.__reproWebVitals;
          if (!lib) {
            resolve([]);
            return;
          }

          // reportAllChanges re-reports CLS, INP and LCP as they change; keep the latest per metric.
          const latest = new Map<WebVitalsMetric['name'], WebVitalsMetric>();
          const record = (name: WebVitalsMetric['name']) => (metric: Omit<WebVitalsMetric, 'name'>) => {
            latest.set(name, { name, value: metric.value, rating: metric.rating, delta: metric.delta, id: metric.id });
          };

          lib.onCLS(record('CLS'), { reportAllChanges: true });
          lib.onINP(record('INP'), { reportAllChanges: true });
          lib.onLCP(record('LCP'), { reportAllChanges: true });
          lib.onFCP(record('FCP'));
          lib.onTTFB(record('TTFB'));

          // Buffered entries report shortly after registration; give them time to arrive.
          setTimeout(() => resolve([...latest.values()]), 2000);
        });
      });

      this.metrics = metrics;
      
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
