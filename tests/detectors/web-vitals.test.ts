import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebVitalsDetector } from '../../src/detectors/web-vitals.js';
import { IssueCategory, IssueSeverity } from '../../src/detectors/base.js';
import type { Page } from '@playwright/test';

describe('WebVitalsDetector', () => {
  let detector: WebVitalsDetector;

  beforeEach(() => {
    detector = new WebVitalsDetector();
  });

  describe('metadata', () => {
    it('should have correct id', () => {
      expect(detector.id).toBe('web-vitals');
    });

    it('should have correct name', () => {
      expect(detector.name).toBe('Web Vitals');
    });

    it('should have correct category', () => {
      expect(detector.category).toBe(IssueCategory.PERFORMANCE);
    });

    it('should have description mentioning CLS, INP, LCP', () => {
      expect(detector.description).toContain('CLS');
      expect(detector.description).toContain('INP');
      expect(detector.description).toContain('LCP');
    });
  });

  describe('getThresholds', () => {
    // Access private method for testing
    const getThresholds = (detector: WebVitalsDetector, metric: string) => {
      return (detector as unknown as {
        getThresholds: (metric: string) => { good: number; poor: number };
      }).getThresholds(metric);
    };

    it('should return correct CLS thresholds', () => {
      const thresholds = getThresholds(detector, 'CLS');
      expect(thresholds.good).toBe(0.1);
      expect(thresholds.poor).toBe(0.25);
    });

    it('should return correct INP thresholds', () => {
      const thresholds = getThresholds(detector, 'INP');
      expect(thresholds.good).toBe(200);
      expect(thresholds.poor).toBe(500);
    });

    it('should return correct LCP thresholds', () => {
      const thresholds = getThresholds(detector, 'LCP');
      expect(thresholds.good).toBe(2500);
      expect(thresholds.poor).toBe(4000);
    });

    it('should return correct FCP thresholds', () => {
      const thresholds = getThresholds(detector, 'FCP');
      expect(thresholds.good).toBe(1800);
      expect(thresholds.poor).toBe(3000);
    });

    it('should return correct TTFB thresholds', () => {
      const thresholds = getThresholds(detector, 'TTFB');
      expect(thresholds.good).toBe(800);
      expect(thresholds.poor).toBe(1800);
    });

    it('should return default thresholds for unknown metrics', () => {
      const thresholds = getThresholds(detector, 'UNKNOWN');
      expect(thresholds.good).toBe(0);
      expect(thresholds.poor).toBe(0);
    });
  });

  describe('getMetrics', () => {
    it('should return empty array before metrics collected', () => {
      expect(detector.getMetrics()).toEqual([]);
    });
  });

  describe('attach', () => {
    it('should complete without errors', async () => {
      const mockPage = {} as Page;
      await expect(detector.attach(mockPage)).resolves.toBeUndefined();
    });
  });

  describe('scan with mocked page.evaluate', () => {
    const createMockPage = (metrics: Array<{
      name: string;
      value: number;
      rating: string;
      delta: number;
      id: string;
    }>) => ({
      url: vi.fn().mockReturnValue('https://example.com/page'),
      evaluate: vi.fn().mockResolvedValue(metrics)
    } as unknown as Page);

    it('should create WARNING for poor CLS rating', async () => {
      const mockPage = createMockPage([
        { name: 'CLS', value: 0.35, rating: 'poor', delta: 0.35, id: 'v4-1234' }
      ]);

      await detector.scan(mockPage);
      expect(detector.issues).toHaveLength(1);
      expect(detector.issues[0].type).toBe('web-vitals-cls');
      expect(detector.issues[0].severity).toBe(IssueSeverity.WARNING);
      expect(detector.issues[0].message).toContain('Poor CLS');
    });

    it('should create WARNING for poor INP rating', async () => {
      const mockPage = createMockPage([
        { name: 'INP', value: 600, rating: 'poor', delta: 600, id: 'v4-1234' }
      ]);

      await detector.scan(mockPage);
      expect(detector.issues).toHaveLength(1);
      expect(detector.issues[0].type).toBe('web-vitals-inp');
      expect(detector.issues[0].severity).toBe(IssueSeverity.WARNING);
    });

    it('should create WARNING for poor LCP rating', async () => {
      const mockPage = createMockPage([
        { name: 'LCP', value: 5000, rating: 'poor', delta: 5000, id: 'v4-1234' }
      ]);

      await detector.scan(mockPage);
      expect(detector.issues).toHaveLength(1);
      expect(detector.issues[0].type).toBe('web-vitals-lcp');
      expect(detector.issues[0].severity).toBe(IssueSeverity.WARNING);
    });

    it('should create WARNING for poor FCP rating', async () => {
      const mockPage = createMockPage([
        { name: 'FCP', value: 4000, rating: 'poor', delta: 4000, id: 'v4-1234' }
      ]);

      await detector.scan(mockPage);
      expect(detector.issues).toHaveLength(1);
      expect(detector.issues[0].type).toBe('web-vitals-fcp');
      expect(detector.issues[0].severity).toBe(IssueSeverity.WARNING);
    });

    it('should create WARNING for poor TTFB rating', async () => {
      const mockPage = createMockPage([
        { name: 'TTFB', value: 2500, rating: 'poor', delta: 2500, id: 'v4-1234' }
      ]);

      await detector.scan(mockPage);
      expect(detector.issues).toHaveLength(1);
      expect(detector.issues[0].type).toBe('web-vitals-ttfb');
      expect(detector.issues[0].severity).toBe(IssueSeverity.WARNING);
    });

    it('should create INFO for needs-improvement CLS', async () => {
      const mockPage = createMockPage([
        { name: 'CLS', value: 0.15, rating: 'needs-improvement', delta: 0.15, id: 'v4-1234' }
      ]);

      await detector.scan(mockPage);
      expect(detector.issues).toHaveLength(1);
      expect(detector.issues[0].severity).toBe(IssueSeverity.INFO);
      expect(detector.issues[0].message).toContain('needs improvement');
    });

    it('should create INFO for needs-improvement INP', async () => {
      const mockPage = createMockPage([
        { name: 'INP', value: 350, rating: 'needs-improvement', delta: 350, id: 'v4-1234' }
      ]);

      await detector.scan(mockPage);
      expect(detector.issues).toHaveLength(1);
      expect(detector.issues[0].severity).toBe(IssueSeverity.INFO);
    });

    it('should create no issues for good-rated metrics', async () => {
      const mockPage = createMockPage([
        { name: 'CLS', value: 0.05, rating: 'good', delta: 0.05, id: 'v4-1234' },
        { name: 'LCP', value: 1500, rating: 'good', delta: 1500, id: 'v4-5678' }
      ]);

      await detector.scan(mockPage);
      expect(detector.issues).toHaveLength(0);
    });

    it('should collect multiple metrics simultaneously', async () => {
      const mockPage = createMockPage([
        { name: 'CLS', value: 0.35, rating: 'poor', delta: 0.35, id: 'v4-1' },
        { name: 'LCP', value: 5000, rating: 'poor', delta: 5000, id: 'v4-2' },
        { name: 'FCP', value: 2000, rating: 'needs-improvement', delta: 2000, id: 'v4-3' }
      ]);

      await detector.scan(mockPage);
      expect(detector.issues).toHaveLength(3);

      const types = detector.issues.map(i => i.type);
      expect(types).toContain('web-vitals-cls');
      expect(types).toContain('web-vitals-lcp');
      expect(types).toContain('web-vitals-fcp');
    });

    it('should include metric values in issue details', async () => {
      const mockPage = createMockPage([
        { name: 'CLS', value: 0.35, rating: 'poor', delta: 0.35, id: 'v4-1234' }
      ]);

      await detector.scan(mockPage);
      const details = JSON.parse(detector.issues[0].details || '{}');
      expect(details.metric).toBe('CLS');
      expect(details.value).toBe(0.35);
      expect(details.rating).toBe('poor');
      expect(details.thresholds).toEqual({ good: 0.1, poor: 0.25 });
    });

    it('should format metric values to 2 decimal places in message', async () => {
      const mockPage = createMockPage([
        { name: 'CLS', value: 0.35678, rating: 'poor', delta: 0.35678, id: 'v4-1234' }
      ]);

      await detector.scan(mockPage);
      expect(detector.issues[0].message).toContain('0.36');
    });

    it('should return empty array when no metrics collected', async () => {
      const mockPage = createMockPage([]);

      const issues = await detector.scan(mockPage);
      expect(issues).toEqual([]);
    });

    it('should return collected metrics via getMetrics()', async () => {
      const metricsData = [
        { name: 'CLS', value: 0.1, rating: 'good', delta: 0.1, id: 'v4-1234' }
      ];
      const mockPage = createMockPage(metricsData);

      await detector.scan(mockPage);
      const metrics = detector.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].name).toBe('CLS');
    });
  });

  describe('error handling', () => {
    it('should return empty array when page.evaluate fails', async () => {
      const mockPage = {
        url: vi.fn().mockReturnValue('https://example.com/page'),
        evaluate: vi.fn().mockRejectedValue(new Error('Script injection failed'))
      } as unknown as Page;

      // Spy on console.error to verify it's called
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const issues = await detector.scan(mockPage);
      expect(issues).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to collect Web Vitals:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('cleanup', () => {
    it('should clear issues on cleanup', async () => {
      const mockPage = {
        url: vi.fn().mockReturnValue('https://example.com/page'),
        evaluate: vi.fn().mockResolvedValue([
          { name: 'CLS', value: 0.35, rating: 'poor', delta: 0.35, id: 'v4-1234' }
        ])
      } as unknown as Page;

      await detector.scan(mockPage);
      expect(detector.issues).toHaveLength(1);

      await detector.cleanup();
      expect(detector.issues).toHaveLength(0);
    });
  });
});
