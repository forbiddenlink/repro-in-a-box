import type { Page, Response } from '@playwright/test';
import { BaseDetector, IssueCategory, IssueSeverity, type DetectorConfig, type Issue } from './base.js';

/** Performance thresholds */
const PERF_LIMITS = {
  JS_SIZE_WARNING: 250 * 1024,      // 250KB
  CSS_SIZE_WARNING: 100 * 1024,     // 100KB
  IMAGE_SIZE_WARNING: 500 * 1024,   // 500KB
  IMAGE_OPTIMIZATION_MIN: 100 * 1024, // 100KB - suggest WebP/AVIF for images larger than this
};

/** Tracked resource information */
interface ResourceInfo {
  url: string;
  type: 'script' | 'stylesheet' | 'image' | 'other';
  size: number;
  mimeType: string;
}

/**
 * Detector for performance issues including render-blocking resources and large assets
 */
export class PerformanceDetector extends BaseDetector {
  readonly id = 'performance';
  readonly name = 'Performance';
  readonly description = 'Detects performance issues: render-blocking resources, large assets, image optimization';
  readonly category = IssueCategory.PERFORMANCE;

  private resources: ResourceInfo[] = [];

  setup(_config?: DetectorConfig): Promise<void> {
    this.resources = [];
    return super.setup(_config);
  }

  async attach(page: Page, _config?: DetectorConfig): Promise<void> {
    // Track all resource responses
    page.on('response', (response: Response) => {
      this.trackResource(response);
    });
  }

  private trackResource(response: Response): void {
    const url = response.url();
    const headers = response.headers();
    const contentType = headers['content-type'] || '';
    const contentLength = parseInt(headers['content-length'] || '0', 10);

    let type: ResourceInfo['type'] = 'other';
    if (contentType.includes('javascript') || url.endsWith('.js')) {
      type = 'script';
    } else if (contentType.includes('css') || url.endsWith('.css')) {
      type = 'stylesheet';
    } else if (contentType.includes('image/')) {
      type = 'image';
    }

    if (type !== 'other') {
      this.resources.push({
        url,
        type,
        size: contentLength,
        mimeType: contentType,
      });
    }
  }

  async scan(page: Page, _config?: DetectorConfig): Promise<Issue[]> {
    const url = page.url();

    // Check render-blocking scripts
    await this.checkRenderBlockingScripts(page, url);

    // Check render-blocking stylesheets
    await this.checkRenderBlockingStyles(page, url);

    // Check large resources
    this.checkLargeResources(url);

    // Check image optimization opportunities
    this.checkImageOptimization(url);

    return this.issues;
  }

  private async checkRenderBlockingScripts(page: Page, url: string): Promise<void> {
    try {
      const blockingScripts = await page.$$eval('head script[src]', (scripts) =>
        scripts
          .filter((s) => !s.async && !s.defer)
          .map((s) => s.getAttribute('src') || '')
          .filter((src) => src)
      );

      for (const scriptSrc of blockingScripts) {
        this.addIssue(this.createIssue(
          'perf-render-blocking-script',
          `Render-blocking script: ${this.truncateUrl(scriptSrc)} (no async/defer)`,
          IssueSeverity.WARNING,
          url,
          { details: JSON.stringify({ script: scriptSrc, recommendation: 'Add async or defer attribute' }, null, 2) }
        ));
      }
    } catch {
      // Page might not have head element
    }
  }

  private async checkRenderBlockingStyles(page: Page, url: string): Promise<void> {
    try {
      const blockingStyles = await page.$$eval('link[rel="stylesheet"]', (links) =>
        links
          .filter((l) => {
            const media = l.getAttribute('media');
            return !media || (media !== 'print' && media !== 'none');
          })
          .map((l) => l.getAttribute('href') || '')
          .filter((href) => href)
      );

      for (const styleSrc of blockingStyles) {
        this.addIssue(this.createIssue(
          'perf-render-blocking-css',
          `Render-blocking stylesheet: ${this.truncateUrl(styleSrc)}`,
          IssueSeverity.INFO,
          url,
          { details: JSON.stringify({ stylesheet: styleSrc, recommendation: 'Consider inlining critical CSS or using media queries' }, null, 2) }
        ));
      }
    } catch {
      // Page might not have stylesheets
    }
  }

  checkLargeResources(url: string): void {
    for (const resource of this.resources) {
      if (resource.type === 'script' && resource.size > PERF_LIMITS.JS_SIZE_WARNING) {
        this.addIssue(this.createIssue(
          'perf-large-js',
          `Large JavaScript file: ${this.truncateUrl(resource.url)} (${this.formatSize(resource.size)})`,
          IssueSeverity.WARNING,
          url,
          { details: JSON.stringify({ file: resource.url, size: resource.size, threshold: PERF_LIMITS.JS_SIZE_WARNING }, null, 2) }
        ));
      }

      if (resource.type === 'stylesheet' && resource.size > PERF_LIMITS.CSS_SIZE_WARNING) {
        this.addIssue(this.createIssue(
          'perf-large-css',
          `Large CSS file: ${this.truncateUrl(resource.url)} (${this.formatSize(resource.size)})`,
          IssueSeverity.WARNING,
          url,
          { details: JSON.stringify({ file: resource.url, size: resource.size, threshold: PERF_LIMITS.CSS_SIZE_WARNING }, null, 2) }
        ));
      }

      if (resource.type === 'image' && resource.size > PERF_LIMITS.IMAGE_SIZE_WARNING) {
        this.addIssue(this.createIssue(
          'perf-large-image',
          `Large image: ${this.truncateUrl(resource.url)} (${this.formatSize(resource.size)})`,
          IssueSeverity.WARNING,
          url,
          { details: JSON.stringify({ file: resource.url, size: resource.size, threshold: PERF_LIMITS.IMAGE_SIZE_WARNING }, null, 2) }
        ));
      }
    }
  }

  checkImageOptimization(url: string): void {
    for (const resource of this.resources) {
      if (resource.type === 'image' && resource.size > PERF_LIMITS.IMAGE_OPTIMIZATION_MIN) {
        const isLegacyFormat =
          resource.mimeType.includes('image/png') ||
          resource.mimeType.includes('image/jpeg') ||
          resource.url.endsWith('.png') ||
          resource.url.endsWith('.jpg') ||
          resource.url.endsWith('.jpeg');

        if (isLegacyFormat) {
          this.addIssue(this.createIssue(
            'perf-unoptimized-image',
            `Consider WebP/AVIF: ${this.truncateUrl(resource.url)} (${this.formatSize(resource.size)})`,
            IssueSeverity.INFO,
            url,
            { details: JSON.stringify({ file: resource.url, size: resource.size, currentFormat: resource.mimeType, recommendation: 'Convert to WebP or AVIF for better compression' }, null, 2) }
          ));
        }
      }
    }
  }

  private truncateUrl(url: string): string {
    try {
      const parsed = new URL(url);
      const path = parsed.pathname;
      if (path.length > 50) {
        return '...' + path.slice(-47);
      }
      return path;
    } catch {
      if (url.length > 50) {
        return '...' + url.slice(-47);
      }
      return url;
    }
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  cleanup(): Promise<void> {
    this.resources = [];
    return super.cleanup();
  }
}
