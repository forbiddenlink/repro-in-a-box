import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type Page } from '@playwright/test';
import {
  DetectorRegistry,
  JavaScriptErrorsDetector,
  NetworkErrorsDetector,
  BrokenAssetsDetector,
  MixedContentDetector,
  BrokenLinksDetector
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

    if (!jsErrors) return;
    
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
  });
});

describe('Mixed Content Detector', () => {
  it('should have correct metadata', () => {
    const detector = new MixedContentDetector();
    
    expect(detector.id).toBe('mixed-content');
    expect(detector.name).toBe('Mixed Content');
    expect(detector.category).toBe('security');
  });

  it('should be instantiable', () => {
    const detector = new MixedContentDetector();
    expect(detector).toBeDefined();
    expect(typeof detector.setup).toBe('function');
    expect(typeof detector.attach).toBe('function');
    expect(typeof detector.collect).toBe('function');
  });
});

describe('Broken Links Detector', () => {
  it('should have correct metadata', () => {
    const detector = new BrokenLinksDetector();
    
    expect(detector.id).toBe('broken-links');
    expect(detector.name).toBe('Broken Links');
    expect(detector.category).toBe('links');
  });

  it('should be instantiable', () => {
    const detector = new BrokenLinksDetector();
    expect(detector).toBeDefined();
    expect(typeof detector.setup).toBe('function');
    expect(typeof detector.attach).toBe('function');
    expect(typeof detector.scan).toBe('function');
  });
});
