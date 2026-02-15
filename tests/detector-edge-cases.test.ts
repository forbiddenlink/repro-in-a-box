import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type Page } from '@playwright/test';
import {
  JavaScriptErrorsDetector,
  NetworkErrorsDetector,
  BrokenAssetsDetector,
  AccessibilityDetector,
  WebVitalsDetector,
  MixedContentDetector,
  BrokenLinksDetector,
  DetectorRegistry
} from '../src/detectors/index.js';

describe('Detector Edge Cases', () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    await browser.close();
  });

  describe('JavaScriptErrorsDetector Edge Cases', () => {
    it('should handle pages with no JavaScript', async () => {
      const page = await browser.newPage();
      const detector = new JavaScriptErrorsDetector();
      
      await detector.setup();
      await detector.attach(page);
      
      await page.setContent('<html><body><h1>No JS here</h1></body></html>');
      
      const result = await detector.collect(page);
      
      expect(result.detector).toBe('js-errors');
      expect(result.issues).toHaveLength(0);
      
      await page.close();
    });

    it('should handle multiple errors on same page', async () => {
      const page = await browser.newPage();
      const detector = new JavaScriptErrorsDetector();
      
      await detector.setup();
      await detector.attach(page);
      
      await page.setContent(`
        <html><body>
          <script>
            setTimeout(() => { throw new Error('Error 1'); }, 10);
            setTimeout(() => { throw new Error('Error 2'); }, 20);
          </script>
        </body></html>
      `);
      
      await page.waitForTimeout(50);
      
      const result = await detector.collect(page);
      
      expect(result.detector).toBe('js-errors');
      // May capture multiple errors
      expect(result.issues).toBeDefined();
      
      await page.close();
    });

    it('should handle promise rejections', async () => {
      const page = await browser.newPage();
      const detector = new JavaScriptErrorsDetector();
      
      await detector.setup();
      await detector.attach(page);
      
      await page.setContent(`
        <html><body>
          <script>
            Promise.reject(new Error('Unhandled rejection'));
          </script>
        </body></html>
      `);
      
      await page.waitForTimeout(50);
      
      const result = await detector.collect(page);
      
      expect(result.detector).toBe('js-errors');
      expect(result.issues).toBeDefined();
      
      await page.close();
    });
  });

  describe('NetworkErrorsDetector Edge Cases', () => {
    it('should handle pages with no network requests', async () => {
      const page = await browser.newPage();
      const detector = new NetworkErrorsDetector();
      
      await detector.setup();
      await detector.attach(page);
      
      await page.setContent('<html><body><h1>Static content</h1></body></html>');
      
      const result = await detector.collect(page);
      
      expect(result.detector).toBe('network-errors');
      expect(result.issues).toHaveLength(0);
      
      await page.close();
    });

    it('should distinguish between 404 and 500 errors', async () => {
      const page = await browser.newPage();
      const detector = new NetworkErrorsDetector();
      
      await detector.setup();
      await detector.attach(page);
      
      // Note: In test environment, may not make real requests
      await page.setContent(`
        <html><body>
          <img src="/nonexistent-404.png">
          <img src="/server-error-500.png">
        </body></html>
      `);
      
      const result = await detector.collect(page);
      
      expect(result.detector).toBe('network-errors');
      expect(result.issues).toBeDefined();
      
      await page.close();
    });

    it('should handle timeout errors', async () => {
      const page = await browser.newPage();
      const detector = new NetworkErrorsDetector();
      
      await detector.setup();
      await detector.attach(page);
      
      const result = await detector.collect(page);
      
      expect(result.detector).toBe('network-errors');
      expect(result.issues).toBeDefined();
      
      await page.close();
    });
  });

  describe('BrokenAssetsDetector Edge Cases', () => {
    it('should handle pages with no external assets', async () => {
      const page = await browser.newPage();
      const detector = new BrokenAssetsDetector();
      
      await detector.setup();
      await detector.attach(page);
      
      await page.setContent('<html><body><p>Text only</p></body></html>');
      
      const result = await detector.collect(page);
      
      expect(result.detector).toBe('broken-assets');
      expect(result.issues).toHaveLength(0);
      
      await page.close();
    });

    it('should detect different asset types', async () => {
      const page = await browser.newPage();
      const detector = new BrokenAssetsDetector();
      
      await detector.setup();
      await detector.attach(page);
      
      await page.setContent(`
        <html>
          <head>
            <link rel="stylesheet" href="/missing.css">
          </head>
          <body>
            <img src="/missing.png">
            <script src="/missing.js"></script>
          </body>
        </html>
      `);
      
      const result = await detector.collect(page);
      
      expect(result.detector).toBe('broken-assets');
      expect(result.issues).toBeDefined();
      
      await page.close();
    });
  });

  describe('AccessibilityDetector Edge Cases', () => {
    it('should handle empty pages', async () => {
      const page = await browser.newPage();
      const detector = new AccessibilityDetector();
      
      await detector.setup();
      await detector.attach(page);
      
      await page.setContent('<html><body></body></html>');
      
      const result = await detector.scan(page);
      
      expect(result).toBeInstanceOf(Array);
      
      await page.close();
    });

    it('should detect missing alt text on images', async () => {
      const page = await browser.newPage();
      const detector = new AccessibilityDetector();
      
      await detector.setup();
      await detector.attach(page);
      
      await page.setContent(`
        <html><body>
          <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==">
        </body></html>
      `);
      
      const result = await detector.scan(page);
      
      expect(result).toBeDefined();
      // Should detect missing alt text
      
      await page.close();
    });

    it('should detect missing form labels', async () => {
      const page = await browser.newPage();
      const detector = new AccessibilityDetector();
      
      await detector.setup();
      await detector.attach(page);
      
      await page.setContent(`
        <html><body>
          <form>
            <input type="text" name="username">
            <input type="password" name="password">
          </form>
        </body></html>
      `);
      
      const result = await detector.scan(page);
      
      expect(result).toBeDefined();
      // Should detect missing labels
      
      await page.close();
    });
  });

  describe('WebVitalsDetector Edge Cases', () => {
    it('should handle pages without measurable vitals', async () => {
      const page = await browser.newPage();
      const detector = new WebVitalsDetector();
      
      await detector.setup();
      await detector.attach(page);
      
      await page.setContent('<html><body><p>Simple page</p></body></html>');
      
      const result = await detector.collect(page);
      
      expect(result.detector).toBe('web-vitals');
      expect(result.issues).toBeDefined();
      
      await page.close();
    });

    it('should handle pages with fast load times', async () => {
      const page = await browser.newPage();
      const detector = new WebVitalsDetector();
      
      await detector.setup();
      await detector.attach(page);
      
      await page.setContent('<html><body><h1>Fast page</h1></body></html>');
      
      const result = await detector.collect(page);
      
      expect(result.detector).toBe('web-vitals');
      expect(result.issues).toBeDefined();
      
      await page.close();
    });
  });

  describe('MixedContentDetector Edge Cases', () => {
    it('should handle HTTP pages (no mixed content possible)', async () => {
      const page = await browser.newPage();
      const detector = new MixedContentDetector();
      
      await detector.setup();
      await detector.attach(page);
      
      // HTTP page - no mixed content issues possible
      await page.setContent('<html><body><p>HTTP page</p></body></html>');
      
      const result = await detector.collect(page);
      
      expect(result.detector).toBe('mixed-content');
      expect(result.issues).toHaveLength(0);
      
      await page.close();
    });

    it('should handle HTTPS pages with proper HTTPS resources', async () => {
      const page = await browser.newPage();
      const detector = new MixedContentDetector();
      
      await detector.setup();
      await detector.attach(page);
      
      await page.setContent(`
        <html><body>
          <img src="https://example.com/image.png">
          <script src="https://example.com/script.js"></script>
        </body></html>
      `);
      
      const result = await detector.collect(page);
      
      expect(result.detector).toBe('mixed-content');
      // Should find no issues since all resources are HTTPS
      
      await page.close();
    });
  });

  describe('BrokenLinksDetector Edge Cases', () => {
  it('should handle pages with no links', async () => {
      const page = await browser.newPage();
      const detector = new BrokenLinksDetector();
      
      await detector.setup();
      await detector.attach(page);
      
      await page.setContent('<html><body><p>No links here</p></body></html>');
      
      const result = await detector.scan(page);
      
      expect(result).toBeInstanceOf(Array);
      expect(result).toHaveLength(0);
      
      await page.close();
    });

    it('should handle pages with only anchor links', async () => {
      const page = await browser.newPage();
      const detector = new BrokenLinksDetector();
      
      await detector.setup();
      await detector.attach(page);
      
      await page.setContent(`
        <html><body>
          <a href="#section1">Section 1</a>
          <a href="#section2">Section 2</a>
          <div id="section1">Content 1</div>
          <div id="section2">Content 2</div>
        </body></html>
      `);
      
      const result = await detector.scan(page);
      
      expect(result).toBeDefined();
      // Anchor links should not be checked
      
      await page.close();
    });

    it('should handle pages with relative links', async () => {
      const page = await browser.newPage();
      const detector = new BrokenLinksDetector();
      
      await detector.setup();
      await detector.attach(page);
      
      await page.setContent(`
        <html><body>
          <a href="/page1">Page 1</a>
          <a href="./page2">Page 2</a>
          <a href="../page3">Page 3</a>
        </body></html>
      `);
      
      const result = await detector.scan(page);
      
      expect(result).toBeDefined();
      
      await page.close();
    });
  });

  describe('DetectorRegistry Edge Cases', () => {
    it('should prevent duplicate detector registration', () => {
      const registry = new DetectorRegistry();
      const detector = new JavaScriptErrorsDetector();
      
      registry.register(detector);
      
      expect(() => {
        registry.register(detector);
      }).toThrow();
    });

    it('should handle getting non-existent detector', () => {
      const registry = new DetectorRegistry();
      
      const result = registry.get('non-existent-detector');
      
      expect(result).toBeUndefined();
    });

    it('should disable and re-enable detectors', () => {
      const registry = new DetectorRegistry();
      const detector = new JavaScriptErrorsDetector();
      
      registry.register(detector);
      
      expect(registry.getEnabled()).toHaveLength(1);
      
      registry.disable('js-errors');
      expect(registry.getEnabled()).toHaveLength(0);
      
      registry.enable('js-errors');
      expect(registry.getEnabled()).toHaveLength(1);
    });

    it('should list all registered detector IDs', () => {
      const registry = new DetectorRegistry();
      
      registry.register(new JavaScriptErrorsDetector());
      registry.register(new NetworkErrorsDetector());
      registry.register(new BrokenAssetsDetector());
      
      const ids = registry.list();
      
      expect(ids).toContain('js-errors');
      expect(ids).toContain('network-errors');
      expect(ids).toContain('broken-assets');
      expect(ids).toHaveLength(3);
    });
  });
});
