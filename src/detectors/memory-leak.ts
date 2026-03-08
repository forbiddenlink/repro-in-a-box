import type { Page } from '@playwright/test';
import { BaseDetector, IssueCategory, IssueSeverity, type DetectorConfig, type Issue } from './base.js';

/** Memory thresholds */
const MEMORY_LIMITS = {
  HIGH_MEMORY_MB: 200,           // 200MB considered high
  GROWTH_WARNING_MB: 50,         // 50MB growth triggers warning
  GROWTH_ERROR_MB: 100,          // 100MB growth triggers error
  EVENT_LISTENER_WARNING: 100,   // More than 100 listeners is suspicious
  DETACHED_NODES_WARNING: 500,   // More than 500 detached nodes
  SAMPLE_INTERVAL_MS: 500,       // Sample memory every 500ms
  SAMPLE_COUNT: 5,               // Take 5 samples
};

/**
 * Detector for memory leaks including growing memory, event listener leaks, and DOM node leaks
 */
export class MemoryLeakDetector extends BaseDetector {
  readonly id = 'memory-leak';
  readonly name = 'Memory Leak';
  readonly description = 'Detects memory leaks: growing heap, event listener leaks, detached DOM nodes';
  readonly category = IssueCategory.PERFORMANCE;

  private memorySamples: number[] = [];

  setup(_config?: DetectorConfig): Promise<void> {
    this.memorySamples = [];
    return super.setup(_config);
  }

  async attach(_page: Page, _config?: DetectorConfig): Promise<void> {
    // No event listeners needed - we sample during scan
  }

  async scan(page: Page, _config?: DetectorConfig): Promise<Issue[]> {
    const url = page.url();

    try {
      // Collect memory samples over time
      await this.collectMemorySamples(page);

      // Analyze memory growth pattern
      if (this.memorySamples.length >= 2) {
        this.analyzeMemoryGrowth(this.memorySamples, url);
      }

      // Check current heap size
      const currentHeap = this.memorySamples[this.memorySamples.length - 1] || 0;
      this.checkHighMemoryUsage(currentHeap, url);

      // Check event listener count
      const listenerCount = await this.getEventListenerCount(page);
      this.checkEventListenerCount(listenerCount, url);

      // Check for detached DOM nodes (approximation via node count)
      const detachedCount = await this.getDetachedNodeCount(page);
      this.checkDetachedNodes(detachedCount, url);

    } catch (error) {
      // Memory APIs may not be available in all contexts
      console.debug('Memory leak detection limited:', error);
    }

    return this.issues;
  }

  /**
   * Collect memory samples over time to detect growth patterns
   */
  private async collectMemorySamples(page: Page): Promise<void> {
    this.memorySamples = [];

    for (let i = 0; i < MEMORY_LIMITS.SAMPLE_COUNT; i++) {
      try {
        const heapSize = await page.evaluate(() => {
          // @ts-expect-error - performance.memory is Chrome-specific
          const memory = performance.memory;
          return memory ? memory.usedJSHeapSize : 0;
        });

        if (heapSize > 0) {
          this.memorySamples.push(heapSize);
        }

        if (i < MEMORY_LIMITS.SAMPLE_COUNT - 1) {
          await page.waitForTimeout(MEMORY_LIMITS.SAMPLE_INTERVAL_MS);
        }
      } catch {
        // Memory API not available
        break;
      }
    }
  }

  /**
   * Analyze memory samples for growth patterns
   */
  private analyzeMemoryGrowth(samples: number[], url: string): void {
    if (samples.length < 2) return;

    const firstSample = samples[0];
    const lastSample = samples[samples.length - 1];
    const growthBytes = lastSample - firstSample;
    const growthMB = growthBytes / (1024 * 1024);

    // Check for significant memory growth
    if (growthMB >= MEMORY_LIMITS.GROWTH_ERROR_MB) {
      this.addIssue(this.createIssue(
        'memory-growth',
        `Critical memory growth detected: +${growthMB.toFixed(1)}MB over ${samples.length} samples`,
        IssueSeverity.ERROR,
        url,
        {
          details: JSON.stringify({
            initialHeapMB: (firstSample / (1024 * 1024)).toFixed(1),
            finalHeapMB: (lastSample / (1024 * 1024)).toFixed(1),
            growthMB: growthMB.toFixed(1),
            samples: samples.length,
            recommendation: 'Check for memory leaks: unreleased event listeners, growing arrays/objects, closures holding references',
          }, null, 2),
        }
      ));
    } else if (growthMB >= MEMORY_LIMITS.GROWTH_WARNING_MB) {
      this.addIssue(this.createIssue(
        'memory-growth',
        `Memory growth detected: +${growthMB.toFixed(1)}MB over ${samples.length} samples`,
        IssueSeverity.WARNING,
        url,
        {
          details: JSON.stringify({
            initialHeapMB: (firstSample / (1024 * 1024)).toFixed(1),
            finalHeapMB: (lastSample / (1024 * 1024)).toFixed(1),
            growthMB: growthMB.toFixed(1),
            samples: samples.length,
            recommendation: 'Monitor memory usage - may indicate a slow leak',
          }, null, 2),
        }
      ));
    }
  }

  /**
   * Check if baseline memory usage is too high
   */
  private checkHighMemoryUsage(heapSize: number, url: string): void {
    const heapMB = heapSize / (1024 * 1024);

    if (heapMB >= MEMORY_LIMITS.HIGH_MEMORY_MB) {
      this.addIssue(this.createIssue(
        'high-memory-usage',
        `High memory usage: ${heapMB.toFixed(1)}MB heap size`,
        IssueSeverity.WARNING,
        url,
        {
          details: JSON.stringify({
            heapMB: heapMB.toFixed(1),
            thresholdMB: MEMORY_LIMITS.HIGH_MEMORY_MB,
            recommendation: 'Consider optimizing memory usage: lazy loading, pagination, cleanup unused data',
          }, null, 2),
        }
      ));
    }
  }

  /**
   * Get approximate event listener count
   */
  private async getEventListenerCount(page: Page): Promise<number> {
    try {
      return await page.evaluate(() => {
        // Approximate by counting elements with common event attributes
        let count = 0;
        const eventAttrs = ['onclick', 'onload', 'onerror', 'onsubmit', 'onchange', 'oninput', 'onkeydown', 'onkeyup', 'onmouseover', 'onmouseout'];

        document.querySelectorAll('*').forEach(el => {
          eventAttrs.forEach(attr => {
            if (el.hasAttribute(attr)) count++;
          });
        });

        // Also check for window/document listeners via a marker
        // This is an approximation since we can't directly count addEventListener calls
        return count;
      });
    } catch {
      return 0;
    }
  }

  /**
   * Check for excessive event listeners
   */
  private checkEventListenerCount(count: number, url: string): void {
    if (count >= MEMORY_LIMITS.EVENT_LISTENER_WARNING) {
      this.addIssue(this.createIssue(
        'excessive-event-listeners',
        `Excessive event listeners detected: ${count} inline handlers`,
        IssueSeverity.WARNING,
        url,
        {
          details: JSON.stringify({
            count,
            threshold: MEMORY_LIMITS.EVENT_LISTENER_WARNING,
            recommendation: 'Consider event delegation or removing listeners when elements are destroyed',
          }, null, 2),
        }
      ));
    }
  }

  /**
   * Get count of potentially detached DOM nodes
   */
  private async getDetachedNodeCount(page: Page): Promise<number> {
    try {
      // This is an approximation - true detached node detection requires CDP
      return await page.evaluate(() => {
        // Count total DOM nodes as a proxy metric
        // High node count can indicate DOM leaks
        return document.getElementsByTagName('*').length;
      });
    } catch {
      return 0;
    }
  }

  /**
   * Check for detached DOM node leaks
   */
  private checkDetachedNodes(count: number, url: string): void {
    if (count >= MEMORY_LIMITS.DETACHED_NODES_WARNING) {
      this.addIssue(this.createIssue(
        'detached-dom-nodes',
        `High DOM node count: ${count} nodes (potential leak)`,
        IssueSeverity.WARNING,
        url,
        {
          details: JSON.stringify({
            count,
            threshold: MEMORY_LIMITS.DETACHED_NODES_WARNING,
            recommendation: 'Check for detached DOM nodes: elements removed from DOM but still referenced in JavaScript',
          }, null, 2),
        }
      ));
    }
  }

  cleanup(): Promise<void> {
    this.memorySamples = [];
    return super.cleanup();
  }
}
