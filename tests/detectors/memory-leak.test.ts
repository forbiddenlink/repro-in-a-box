import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryLeakDetector } from '../../src/detectors/memory-leak.js';
import { IssueCategory, IssueSeverity } from '../../src/detectors/base.js';

describe('MemoryLeakDetector', () => {
  let detector: MemoryLeakDetector;

  beforeEach(() => {
    detector = new MemoryLeakDetector();
  });

  describe('metadata', () => {
    it('should have correct id', () => {
      expect(detector.id).toBe('memory-leak');
    });

    it('should have correct name', () => {
      expect(detector.name).toBe('Memory Leak');
    });

    it('should have correct category', () => {
      expect(detector.category).toBe(IssueCategory.PERFORMANCE);
    });

    it('should have description mentioning memory', () => {
      expect(detector.description.toLowerCase()).toContain('memory');
    });
  });

  describe('memory growth detection', () => {
    it('should detect significant memory growth', () => {
      const analyzeMemoryGrowth = (detector as unknown as {
        analyzeMemoryGrowth: (samples: number[], url: string) => void;
      }).analyzeMemoryGrowth.bind(detector);

      // Simulate growing memory: 10MB -> 70MB (60MB growth, above 50MB threshold)
      const samples = [10_000_000, 25_000_000, 40_000_000, 55_000_000, 70_000_000];
      analyzeMemoryGrowth(samples, 'https://example.com');

      const issue = detector.issues.find(i => i.type === 'memory-growth');
      expect(issue).toBeDefined();
      expect(issue?.severity).toBe(IssueSeverity.WARNING);
    });

    it('should not flag stable memory usage', () => {
      const analyzeMemoryGrowth = (detector as unknown as {
        analyzeMemoryGrowth: (samples: number[], url: string) => void;
      }).analyzeMemoryGrowth.bind(detector);

      // Stable memory around 20MB with small variations
      const samples = [20_000_000, 21_000_000, 19_500_000, 20_500_000, 20_000_000];
      analyzeMemoryGrowth(samples, 'https://example.com');

      expect(detector.issues.length).toBe(0);
    });

    it('should detect critical memory growth (>100MB increase)', () => {
      const analyzeMemoryGrowth = (detector as unknown as {
        analyzeMemoryGrowth: (samples: number[], url: string) => void;
      }).analyzeMemoryGrowth.bind(detector);

      // 50MB -> 200MB growth
      const samples = [50_000_000, 100_000_000, 150_000_000, 200_000_000];
      analyzeMemoryGrowth(samples, 'https://example.com');

      const issue = detector.issues.find(i => i.type === 'memory-growth');
      expect(issue).toBeDefined();
      expect(issue?.severity).toBe(IssueSeverity.ERROR);
    });
  });

  describe('event listener leak detection', () => {
    it('should detect excessive event listeners', () => {
      const checkEventListenerCount = (detector as unknown as {
        checkEventListenerCount: (count: number, url: string) => void;
      }).checkEventListenerCount.bind(detector);

      checkEventListenerCount(150, 'https://example.com');

      const issue = detector.issues.find(i => i.type === 'excessive-event-listeners');
      expect(issue).toBeDefined();
      expect(issue?.severity).toBe(IssueSeverity.WARNING);
    });

    it('should not flag normal event listener count', () => {
      const checkEventListenerCount = (detector as unknown as {
        checkEventListenerCount: (count: number, url: string) => void;
      }).checkEventListenerCount.bind(detector);

      checkEventListenerCount(50, 'https://example.com');
      expect(detector.issues.length).toBe(0);
    });
  });

  describe('DOM node leak detection', () => {
    it('should detect excessive detached DOM nodes', () => {
      const checkDetachedNodes = (detector as unknown as {
        checkDetachedNodes: (count: number, url: string) => void;
      }).checkDetachedNodes.bind(detector);

      checkDetachedNodes(1000, 'https://example.com');

      const issue = detector.issues.find(i => i.type === 'detached-dom-nodes');
      expect(issue).toBeDefined();
      expect(issue?.severity).toBe(IssueSeverity.WARNING);
    });

    it('should not flag low detached node count', () => {
      const checkDetachedNodes = (detector as unknown as {
        checkDetachedNodes: (count: number, url: string) => void;
      }).checkDetachedNodes.bind(detector);

      checkDetachedNodes(50, 'https://example.com');
      expect(detector.issues.length).toBe(0);
    });
  });

  describe('high memory usage detection', () => {
    it('should detect high baseline memory', () => {
      const checkHighMemoryUsage = (detector as unknown as {
        checkHighMemoryUsage: (heapSize: number, url: string) => void;
      }).checkHighMemoryUsage.bind(detector);

      // 500MB heap
      checkHighMemoryUsage(500_000_000, 'https://example.com');

      const issue = detector.issues.find(i => i.type === 'high-memory-usage');
      expect(issue).toBeDefined();
    });

    it('should not flag normal memory usage', () => {
      const checkHighMemoryUsage = (detector as unknown as {
        checkHighMemoryUsage: (heapSize: number, url: string) => void;
      }).checkHighMemoryUsage.bind(detector);

      // 50MB heap - normal
      checkHighMemoryUsage(50_000_000, 'https://example.com');
      expect(detector.issues.length).toBe(0);
    });
  });
});
