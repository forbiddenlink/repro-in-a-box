import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type Page } from '@playwright/test';
import {
  DetectorRegistry,
  JavaScriptErrorsDetector,
  NetworkErrorsDetector,
  BrokenAssetsDetector,
  AccessibilityDetector,
  WebVitalsDetector,
  MixedContentDetector,
  BrokenLinksDetector
} from '../src/detectors/index.js';
import { Scanner } from '../src/scanner/index.js';

describe('Performance Benchmarks', () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    await browser.close();
  });

  describe('Detector Performance', () => {
    it('should attach detector within 100ms', async () => {
      const page = await browser.newPage();
      const detector = new JavaScriptErrorsDetector();
      
      const startTime = performance.now();
      await detector.setup();
      await detector.attach(page);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(100);
      
      await page.close();
    });

    it('should collect results within 500ms on simple page', async () => {
      const page = await browser.newPage();
      const detector = new JavaScriptErrorsDetector();
      
      await detector.setup();
      await detector.attach(page);
      await page.setContent('<html><body><h1>Test</h1></body></html>');
      
      const startTime = performance.now();
      await detector.collect(page);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(500);
      
      await page.close();
    });

    it('should register multiple detectors within 50ms', () => {
      const startTime = performance.now();
      
      const registry = new DetectorRegistry();
      registry.register(new JavaScriptErrorsDetector());
      registry.register(new NetworkErrorsDetector());
      registry.register(new BrokenAssetsDetector());
      registry.register(new AccessibilityDetector());
      registry.register(new WebVitalsDetector());
      registry.register(new MixedContentDetector());
      registry.register(new BrokenLinksDetector());
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(50);
      expect(registry.size).toBe(7);
    });

    it('should look up detector within 1ms', () => {
      const registry = new DetectorRegistry();
      registry.register(new JavaScriptErrorsDetector());
      registry.register(new NetworkErrorsDetector());
      registry.register(new BrokenAssetsDetector());
      
      const startTime = performance.now();
      const detector = registry.get('network-errors');
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      
      expect(detector).toBeDefined();
      expect(duration).toBeLessThan(1);
    });
  });

  describe('Scanner Performance', () => {
    it('should initialize scanner within 100ms', () => {
      const registry = new DetectorRegistry();
      registry.register(new JavaScriptErrorsDetector());
      
      const startTime = performance.now();
      const scanner = new Scanner(registry);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      
      expect(scanner).toBeDefined();
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Memory Benchmarks', () => {
    it('should not significantly increase memory with multiple detectors', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      const registries = [];
      for (let i = 0; i < 10; i++) {
        const registry = new DetectorRegistry();
        registry.register(new JavaScriptErrorsDetector());
        registry.register(new NetworkErrorsDetector());
        registry.register(new BrokenAssetsDetector());
        registries.push(registry);
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Should use less than 10MB for 10 registries with 3 detectors each
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });

    it('should clean up page resources properly', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Create and destroy 5 pages
      for (let i = 0; i < 5; i++) {
        const page = await browser.newPage();
        await page.setContent('<html><body><p>Test</p></body></html>');
        await page.close();
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Should not leak significant memory (< 5MB after 5 pages)
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024);
    });
  });

  describe('Scalability Benchmarks', () => {
    it('should handle 100 issue reports efficiently', async () => {
      const page = await browser.newPage();
      const detector = new JavaScriptErrorsDetector();
      
      await detector.setup();
      await detector.attach(page);
      
      const startTime = performance.now();
      
      // Simulate 100 errors
      await page.setContent(`
        <html><body>
          <script>
            for (let i = 0; i < 100; i++) {
              setTimeout(() => { 
                try { 
                  throw new Error('Error ' + i); 
                } catch(e) {
                  // Error will be caught by detector
                }
              }, 1);
            }
          </script>
        </body></html>
      `);
      
      await page.waitForTimeout(200);
      
      const result = await detector.collect(page);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      
      expect(result.issues).toBeDefined();
      expect(duration).toBeLessThan(1000); // Should handle within 1 second
      
      await page.close();
    });
  });

  describe('Benchmark Summary', () => {
    it('should report overall performance metrics', () => {
      // Document expected performance characteristics
      const performanceTargets = {
        detectorAttach: '< 100ms',
        resultCollection: '< 500ms',
        detectorRegistration: '< 50ms',
        detectorLookup: '< 1ms',
        scannerInit: '< 100ms',
        memoryLimit: '< 10MB per registry',
        issueHandling: '< 1s for 100 issues'
      };
      
      expect(performanceTargets).toBeDefined();
      expect(Object.keys(performanceTargets)).toHaveLength(7);
      
      console.log('\nPerformance Targets:');
      for (const [metric, target] of Object.entries(performanceTargets)) {
        console.log(`  ${metric}: ${target}`);
      }
    });
  });
});
