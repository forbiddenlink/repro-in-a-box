/**
 * Tests for progress reporter
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ProgressReporter,
  createProgressReporter,
  getProgressReporter,
  resetProgressReporter,
  type ProgressEvent,
  type ProgressMetrics
} from '../../src/utils/progress.js';

describe('ProgressReporter', () => {
  let reporter: ProgressReporter;

  beforeEach(() => {
    reporter = new ProgressReporter({ format: 'minimal', enabled: false });
    resetProgressReporter();
  });

  afterEach(() => {
    resetProgressReporter();
  });

  describe('Basic Progress Tracking', () => {
    it('should track pages completed', () => {
      reporter.startPage('https://example.com/page1');
      reporter.completePage('https://example.com/page1');

      const metrics = reporter.getMetrics();
      expect(metrics.pagesCompleted).toBe(1);
    });

    it('should track all completed pages', () => {
      reporter.startPage('https://example.com/page1');
      reporter.completePage('https://example.com/page1');

      reporter.startPage('https://example.com/page2');
      reporter.completePage('https://example.com/page2');

      const metrics = reporter.getMetrics();
      expect(metrics.pagesCompleted).toBe(2);
    });

    it('should track issues found', () => {
      reporter.foundIssue('error', 'broken-links');
      reporter.foundIssue('warning', 'accessibility');
      reporter.foundIssue('error', 'broken-links');

      const metrics = reporter.getMetrics();
      expect(metrics.issuesFound).toBe(3);
    });
  });

  describe('Detector Tracking', () => {
    it('should track completed detectors', () => {
      reporter.completeDetector('javascript-errors');
      reporter.completeDetector('broken-links');

      const metrics = reporter.getMetrics();
      expect(metrics.detectorsCached).toContain('javascript-errors');
      expect(metrics.detectorsCached).toContain('broken-links');
      expect(metrics.detectorsCached.length).toBe(2);
    });

    it('should not duplicate detector tracking', () => {
      reporter.completeDetector('javascript-errors');
      reporter.completeDetector('javascript-errors');

      const metrics = reporter.getMetrics();
      expect(metrics.detectorsCached.length).toBe(1);
    });
  });

  describe('Progress Calculation', () => {
    it('should calculate progress percent', () => {
      reporter.setEstimatedPages(10);
      reporter.completePage('https://example.com/page1');
      reporter.completePage('https://example.com/page2');
      reporter.completePage('https://example.com/page3');

      const metrics = reporter.getMetrics();
      expect(metrics.progressPercent).toBe(30);
    });

    it('should return undefined progress when no estimate', () => {
      reporter.completePage('https://example.com/page1');

      const metrics = reporter.getMetrics();
      expect(metrics.progressPercent).toBeUndefined();
    });

    it('should calculate ETA based on average page time', async () => {
      reporter.setEstimatedPages(10);

      // Simulate 2 completed pages with some time elapsed
      reporter.completePage('https://example.com/page1');
      
      // Wait a bit to simulate actual time
      await new Promise(resolve => setTimeout(resolve, 50));
      
      reporter.completePage('https://example.com/page2');

      const metrics = reporter.getMetrics();
      expect(metrics.etaMs).toBeDefined();
      expect(metrics.etaMs).toBeGreaterThan(0);
      // With 8 remaining pages and avg ~25ms per page, ETA should be roughly 200ms
      expect(metrics.etaMs).toBeGreaterThan(100);
    });
  });

  describe('Time Tracking', () => {
    it('should track elapsed time', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));

      const metrics = reporter.getMetrics();
      expect(metrics.timeElapsedMs).toBeGreaterThanOrEqual(100);
    });

    it('should increase elapsed time over time', async () => {
      const metrics1 = reporter.getMetrics();
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const metrics2 = reporter.getMetrics();
      expect(metrics2.timeElapsedMs).toBeGreaterThan(metrics1.timeElapsedMs);
    });
  });

  describe('Events', () => {
    it('should emit page-started event', async () => {
      return new Promise<void>((resolve) => {
        reporter.on('page-started', (event: ProgressEvent) => {
          expect(event.type).toBe('page-started');
          expect(event.data.url).toBe('https://example.com');
          resolve();
        });

        reporter.startPage('https://example.com');
      });
    });

    it('should emit page-completed event', async () => {
      return new Promise<void>((resolve) => {
        reporter.on('page-completed', (event: ProgressEvent) => {
          expect(event.type).toBe('page-completed');
          expect(event.data.pagesCompleted).toBe(1);
          resolve();
        });

        reporter.completePage('https://example.com');
      });
    });

    it('should emit issue-found event', async () => {
      return new Promise<void>((resolve) => {
        reporter.on('issue-found', (event: ProgressEvent) => {
          expect(event.type).toBe('issue-found');
          expect(event.data.severity).toBe('error');
          expect(event.data.category).toBe('broken-links');
          expect(event.data.totalIssues).toBe(1);
          resolve();
        });

        reporter.foundIssue('error', 'broken-links');
      });
    });

    it('should emit detector-completed event', async () => {
      return new Promise<void>((resolve) => {
        reporter.on('detector-completed', (event: ProgressEvent) => {
          expect(event.type).toBe('detector-completed');
          expect(event.data.detector).toBe('javascript-errors');
          resolve();
        });

        reporter.completeDetector('javascript-errors');
      });
    });

    it('should emit scan-completed event', async () => {
      return new Promise<void>((resolve) => {
        reporter.on('scan-completed', (event: ProgressEvent) => {
          expect(event.type).toBe('scan-completed');
          expect(event.data.pagesCompleted).toBe(1);
          expect(event.data.issuesFound).toBe(2);
          resolve();
        });

        reporter.completePage('https://example.com');
        reporter.foundIssue('error', 'broken-links');
        reporter.foundIssue('warning', 'accessibility');
        reporter.complete();
      });
    });

    it('should support multiple listeners for same event', () => {
      let count = 0;

      reporter.on('page-started', () => count++);
      reporter.on('page-started', () => count++);
      reporter.on('page-started', () => count++);

      reporter.startPage('https://example.com');

      expect(count).toBe(3);
    });
  });

  describe('Factory Functions', () => {
    it('should create new reporter with createProgressReporter', () => {
      const r1 = createProgressReporter({ format: 'simple' });
      const r2 = createProgressReporter({ format: 'detailed' });

      expect(r1).not.toBe(r2);
    });

    it('should use global reporter with getProgressReporter', () => {
      const r1 = getProgressReporter();
      const r2 = getProgressReporter();

      expect(r1).toBe(r2);
    });

    it('should reset global reporter', () => {
      const r1 = getProgressReporter();
      resetProgressReporter();
      const r2 = getProgressReporter();

      expect(r1).not.toBe(r2);
    });
  });

  describe('Format Options', () => {
    it('should accept simple format', () => {
      const r = new ProgressReporter({ format: 'simple' });
      expect(r).toBeDefined();
    });

    it('should accept detailed format', () => {
      const r = new ProgressReporter({ format: 'detailed' });
      expect(r).toBeDefined();
    });

    it('should accept minimal format', () => {
      const r = new ProgressReporter({ format: 'minimal' });
      expect(r).toBeDefined();
    });
  });

  describe('Configuration', () => {
    it('should respect enabled flag', () => {
      const disabledReporter = new ProgressReporter({ enabled: false });
      
      disabledReporter.startPage('https://example.com');
      disabledReporter.completePage('https://example.com');

      const metrics = disabledReporter.getMetrics();
      expect(metrics.pagesCompleted).toBe(1);
    });

    it('should respect throttle ms option', async () => {
      const r = new ProgressReporter({ throttleMs: 1000, enabled: true, format: 'simple' });
      
      // Write spy
      const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => {
        return true as any;
      });

      r.completePage('https://example.com');
      r.completePage('https://example.com');
      r.completePage('https://example.com');

      // Should throttle, so not every update is displayed
      expect(writeSpy.mock.calls.length).toBeLessThan(3);

      writeSpy.mockRestore();
    });
  });

  describe('Metrics', () => {
    it('should return complete metrics object', () => {
      reporter.setEstimatedPages(10);
      reporter.completePage('https://example.com/page1');
      reporter.foundIssue('error', 'broken-links');
      reporter.completeDetector('javascript-errors');

      const metrics = reporter.getMetrics();

      expect(metrics).toHaveProperty('pagesCompleted');
      expect(metrics).toHaveProperty('pagesTotalEstimate');
      expect(metrics).toHaveProperty('issuesFound');
      expect(metrics).toHaveProperty('detectorsCached');
      expect(metrics).toHaveProperty('timeElapsedMs');
      expect(metrics).toHaveProperty('progressPercent');

      expect(metrics.pagesCompleted).toBe(1);
      expect(metrics.pagesTotalEstimate).toBe(10);
      expect(metrics.issuesFound).toBe(1);
      expect(metrics.detectorsCached).toEqual(['javascript-errors']);
    });
  });
});
