import { describe, it, expect, beforeEach } from 'vitest';
import { PerformanceDetector } from '../../src/detectors/performance.js';
import { IssueCategory } from '../../src/detectors/base.js';

describe('PerformanceDetector', () => {
  let detector: PerformanceDetector;

  beforeEach(() => {
    detector = new PerformanceDetector();
  });

  describe('metadata', () => {
    it('should have correct id', () => {
      expect(detector.id).toBe('performance');
    });

    it('should have correct name', () => {
      expect(detector.name).toBe('Performance');
    });

    it('should have correct category', () => {
      expect(detector.category).toBe(IssueCategory.PERFORMANCE);
    });

    it('should have description mentioning key features', () => {
      expect(detector.description).toContain('render-blocking');
      expect(detector.description).toContain('large assets');
    });
  });

  describe('large resource checks', () => {
    it('should detect large JS file', () => {
      // Simulate tracked resource
      (detector as unknown as { resources: Array<{ url: string; type: string; size: number; mimeType: string }> }).resources = [
        { url: 'https://example.com/bundle.js', type: 'script', size: 300 * 1024, mimeType: 'application/javascript' }
      ];

      const checkLargeResources = (detector as unknown as {
        checkLargeResources: (url: string) => void;
      }).checkLargeResources.bind(detector);

      checkLargeResources('https://example.com');
      expect(detector.issues.length).toBe(1);
      expect(detector.issues[0].type).toBe('perf-large-js');
    });

    it('should not flag JS file under threshold', () => {
      (detector as unknown as { resources: Array<{ url: string; type: string; size: number; mimeType: string }> }).resources = [
        { url: 'https://example.com/small.js', type: 'script', size: 100 * 1024, mimeType: 'application/javascript' }
      ];

      const checkLargeResources = (detector as unknown as {
        checkLargeResources: (url: string) => void;
      }).checkLargeResources.bind(detector);

      checkLargeResources('https://example.com');
      expect(detector.issues.length).toBe(0);
    });

    it('should detect large CSS file', () => {
      (detector as unknown as { resources: Array<{ url: string; type: string; size: number; mimeType: string }> }).resources = [
        { url: 'https://example.com/styles.css', type: 'stylesheet', size: 150 * 1024, mimeType: 'text/css' }
      ];

      const checkLargeResources = (detector as unknown as {
        checkLargeResources: (url: string) => void;
      }).checkLargeResources.bind(detector);

      checkLargeResources('https://example.com');
      expect(detector.issues.length).toBe(1);
      expect(detector.issues[0].type).toBe('perf-large-css');
    });

    it('should not flag CSS file under threshold', () => {
      (detector as unknown as { resources: Array<{ url: string; type: string; size: number; mimeType: string }> }).resources = [
        { url: 'https://example.com/small.css', type: 'stylesheet', size: 50 * 1024, mimeType: 'text/css' }
      ];

      const checkLargeResources = (detector as unknown as {
        checkLargeResources: (url: string) => void;
      }).checkLargeResources.bind(detector);

      checkLargeResources('https://example.com');
      expect(detector.issues.length).toBe(0);
    });

    it('should detect large image', () => {
      (detector as unknown as { resources: Array<{ url: string; type: string; size: number; mimeType: string }> }).resources = [
        { url: 'https://example.com/hero.png', type: 'image', size: 600 * 1024, mimeType: 'image/png' }
      ];

      const checkLargeResources = (detector as unknown as {
        checkLargeResources: (url: string) => void;
      }).checkLargeResources.bind(detector);

      checkLargeResources('https://example.com');
      expect(detector.issues.length).toBe(1);
      expect(detector.issues[0].type).toBe('perf-large-image');
    });

    it('should not flag image under threshold', () => {
      (detector as unknown as { resources: Array<{ url: string; type: string; size: number; mimeType: string }> }).resources = [
        { url: 'https://example.com/icon.png', type: 'image', size: 50 * 1024, mimeType: 'image/png' }
      ];

      const checkLargeResources = (detector as unknown as {
        checkLargeResources: (url: string) => void;
      }).checkLargeResources.bind(detector);

      checkLargeResources('https://example.com');
      expect(detector.issues.length).toBe(0);
    });
  });

  describe('image optimization checks', () => {
    it('should suggest WebP for large JPEG', () => {
      (detector as unknown as { resources: Array<{ url: string; type: string; size: number; mimeType: string }> }).resources = [
        { url: 'https://example.com/photo.jpg', type: 'image', size: 150 * 1024, mimeType: 'image/jpeg' }
      ];

      const checkImageOptimization = (detector as unknown as {
        checkImageOptimization: (url: string) => void;
      }).checkImageOptimization.bind(detector);

      checkImageOptimization('https://example.com');
      expect(detector.issues.length).toBe(1);
      expect(detector.issues[0].type).toBe('perf-unoptimized-image');
      expect(detector.issues[0].message).toContain('WebP/AVIF');
    });

    it('should suggest WebP for large PNG', () => {
      (detector as unknown as { resources: Array<{ url: string; type: string; size: number; mimeType: string }> }).resources = [
        { url: 'https://example.com/graphic.png', type: 'image', size: 200 * 1024, mimeType: 'image/png' }
      ];

      const checkImageOptimization = (detector as unknown as {
        checkImageOptimization: (url: string) => void;
      }).checkImageOptimization.bind(detector);

      checkImageOptimization('https://example.com');
      expect(detector.issues.length).toBe(1);
      expect(detector.issues[0].type).toBe('perf-unoptimized-image');
    });

    it('should not suggest WebP for already optimized WebP', () => {
      (detector as unknown as { resources: Array<{ url: string; type: string; size: number; mimeType: string }> }).resources = [
        { url: 'https://example.com/image.webp', type: 'image', size: 150 * 1024, mimeType: 'image/webp' }
      ];

      const checkImageOptimization = (detector as unknown as {
        checkImageOptimization: (url: string) => void;
      }).checkImageOptimization.bind(detector);

      checkImageOptimization('https://example.com');
      expect(detector.issues.length).toBe(0);
    });

    it('should not flag small images for optimization', () => {
      (detector as unknown as { resources: Array<{ url: string; type: string; size: number; mimeType: string }> }).resources = [
        { url: 'https://example.com/tiny.jpg', type: 'image', size: 50 * 1024, mimeType: 'image/jpeg' }
      ];

      const checkImageOptimization = (detector as unknown as {
        checkImageOptimization: (url: string) => void;
      }).checkImageOptimization.bind(detector);

      checkImageOptimization('https://example.com');
      expect(detector.issues.length).toBe(0);
    });
  });

  describe('no issues scenario', () => {
    it('should report no issues for optimized page', () => {
      (detector as unknown as { resources: Array<{ url: string; type: string; size: number; mimeType: string }> }).resources = [
        { url: 'https://example.com/app.js', type: 'script', size: 50 * 1024, mimeType: 'application/javascript' },
        { url: 'https://example.com/styles.css', type: 'stylesheet', size: 20 * 1024, mimeType: 'text/css' },
        { url: 'https://example.com/logo.webp', type: 'image', size: 30 * 1024, mimeType: 'image/webp' }
      ];

      const checkLargeResources = (detector as unknown as {
        checkLargeResources: (url: string) => void;
      }).checkLargeResources.bind(detector);

      const checkImageOptimization = (detector as unknown as {
        checkImageOptimization: (url: string) => void;
      }).checkImageOptimization.bind(detector);

      checkLargeResources('https://example.com');
      checkImageOptimization('https://example.com');
      expect(detector.issues.length).toBe(0);
    });
  });

  describe('empty resources scenario', () => {
    it('should handle pages with no resources gracefully', () => {
      (detector as unknown as { resources: Array<{ url: string; type: string; size: number; mimeType: string }> }).resources = [];

      const checkLargeResources = (detector as unknown as {
        checkLargeResources: (url: string) => void;
      }).checkLargeResources.bind(detector);

      const checkImageOptimization = (detector as unknown as {
        checkImageOptimization: (url: string) => void;
      }).checkImageOptimization.bind(detector);

      checkLargeResources('https://example.com');
      checkImageOptimization('https://example.com');
      expect(detector.issues.length).toBe(0);
    });
  });
});
