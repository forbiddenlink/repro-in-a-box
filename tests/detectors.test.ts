import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type Page } from '@playwright/test';
import {
  DetectorRegistry,
  JavaScriptErrorsDetector,
  NetworkErrorsDetector,
  BrokenAssetsDetector
} from '../src/detectors/index.js';

describe('Detector Framework', () => {
  let browser: Browser;
  let page: Page;
  let registry: DetectorRegistry;

  beforeAll(async () => {
    browser = await chromium.launch();
    page = await browser.newPage();
    registry = new DetectorRegistry();
  });

  afterAll(async () => {
    await page.close();
    await browser.close();
  });

  it('should register detectors', () => {
    const jsErrors = new JavaScriptErrorsDetector();
    const networkErrors = new NetworkErrorsDetector();
    const brokenAssets = new BrokenAssetsDetector();

    registry.register(jsErrors);
    registry.register(networkErrors);
    registry.register(brokenAssets);

    expect(registry.size).toBe(3);
    expect(registry.has('js-errors')).toBe(true);
    expect(registry.has('network-errors')).toBe(true);
    expect(registry.has('broken-assets')).toBe(true);
  });

  it('should list detector IDs', () => {
    const ids = registry.list();
    expect(ids).toContain('js-errors');
    expect(ids).toContain('network-errors');
    expect(ids).toContain('broken-assets');
  });

  it('should get enabled detectors', () => {
    const enabled = registry.getEnabled();
    expect(enabled.length).toBe(3);
  });

  it('should disable and enable detectors', () => {
    registry.disable('js-errors');
    expect(registry.getEnabled().length).toBe(2);

    registry.enable('js-errors');
    expect(registry.getEnabled().length).toBe(3);
  });

  it('should attach detectors to a page', async () => {
    const jsErrors = registry.get('js-errors');
    expect(jsErrors).toBeDefined();

    if (jsErrors) {
      await jsErrors.setup();
      await jsErrors.attach(page);
      
      // Navigate to a simple page
      await page.goto('https://example.com');
      
      // Collect results
      const result = await jsErrors.collect(page);
      
      expect(result.detector).toBe('js-errors');
      expect(result.url).toContain('example.com');
      expect(result.issues).toBeInstanceOf(Array);
      expect(result.duration).toBeGreaterThan(0);
    }
  });
});
