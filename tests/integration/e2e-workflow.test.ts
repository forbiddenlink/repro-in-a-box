/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
/**
 * End-to-end integration tests
 * Tests the full scan → bundle → validate workflow
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Scanner } from '../../src/scanner';
import { 
  DetectorRegistry, 
  JavaScriptErrorsDetector,
  NetworkErrorsDetector,
  BrokenAssetsDetector,
  AccessibilityDetector,
  WebVitalsDetector,
  MixedContentDetector,
  BrokenLinksDetector
} from '../../src/detectors/index';
import { validateReproducibility } from '../../src/determinism/replayer';
import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

// Test websites with known characteristics
const TEST_SITES = {
  simple: 'https://example.com',
  // Add more test sites here if needed
};

const TEST_OUTPUT_DIR = path.join(process.cwd(), 'test-output');

describe('E2E Workflow', () => {
  beforeAll(async () => {
    // Create test output directory
    if (!existsSync(TEST_OUTPUT_DIR)) {
      await fs.mkdir(TEST_OUTPUT_DIR, { recursive: true });
    }
  });

  afterAll(async () => {
    // Clean up test output directory
    try {
      await fs.rm(TEST_OUTPUT_DIR, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to clean up test output:', error);
    }
  });

  it('should complete full scan workflow', async () => {
    const registry = new DetectorRegistry();
    registry.register(new JavaScriptErrorsDetector());
    registry.register(new NetworkErrorsDetector());
    registry.register(new BrokenAssetsDetector());
    registry.register(new AccessibilityDetector());
    registry.register(new WebVitalsDetector());
    registry.register(new MixedContentDetector());
    registry.register(new BrokenLinksDetector());

    const scanner = new Scanner(registry);
    
    const results = await scanner.scan({
      url: TEST_SITES.simple,
      screenshots: false,
      crawler: {
        maxDepth: 1,
        maxPages: 1,
        rateLimitMs: 100,
      },
    });

    expect(results).toBeDefined();
    expect(results.url).toBe(TEST_SITES.simple);
    expect(results.pages).toHaveLength(1);
    expect(results.summary).toBeDefined();
    expect(results.summary.totalIssues).toBeGreaterThanOrEqual(0);
  }, 30000); // 30s timeout for network

  it('should create bundle with HAR and validate', async () => {
    const registry = new DetectorRegistry();
    registry.register(new JavaScriptErrorsDetector());
    registry.register(new NetworkErrorsDetector());
    registry.register(new BrokenAssetsDetector());
    registry.register(new AccessibilityDetector());
    registry.register(new WebVitalsDetector());
    registry.register(new MixedContentDetector());
    registry.register(new BrokenLinksDetector());

    const scanner = new Scanner(registry);
    
    // Step 1: Scan with HAR recording
    const harPath = path.join(TEST_OUTPUT_DIR, 'test.har');
    const results = await scanner.scan({
      url: TEST_SITES.simple,
      screenshots: false,
      crawler: {
        maxDepth: 1,
        maxPages: 1,
        rateLimitMs: 100,
      },
      recordHar: true,
      harPath,
    });

    expect(results).toBeDefined();
    expect(existsSync(harPath)).toBe(true);

    // Step 2: Create a minimal bundle for validation
    const { createBundle } = await import('../../src/bundler/index.js');
    const bundleResult = await createBundle({
      scanResults: results,
      harPath: harPath, // Use the harPath we explicitly created
      outputDir: TEST_OUTPUT_DIR,
    });

    expect(bundleResult).toBeDefined();
    expect(bundleResult.bundlePath).toBeDefined();
    expect(existsSync(bundleResult.bundlePath)).toBe(true);

    // Step 3: Validate reproducibility
    const validation = await validateReproducibility({
      bundlePath: bundleResult.bundlePath,
      runs: 2, // Use 2 runs for faster test
      outputDir: TEST_OUTPUT_DIR,
    });

    expect(validation).toBeDefined();
    expect(validation.reproducibilityScore).toBeGreaterThanOrEqual(0);
    expect(validation.reproducibilityScore).toBeLessThanOrEqual(100);
    expect(validation.replayRuns).toHaveLength(2);
    expect(validation.originalScan).toBeDefined();
  }, 60000); // 60s timeout for validation

  it('should handle empty scan results', async () => {
    const registry = new DetectorRegistry();
    registry.register(new JavaScriptErrorsDetector());
    registry.register(new NetworkErrorsDetector());
    registry.register(new BrokenAssetsDetector());
    registry.register(new AccessibilityDetector());
    registry.register(new WebVitalsDetector());
    registry.register(new MixedContentDetector());
    registry.register(new BrokenLinksDetector());

    const scanner = new Scanner(registry);
    
    const results = await scanner.scan({
      url: TEST_SITES.simple,
      screenshots: false,
      crawler: {
        maxDepth: 1,
        maxPages: 1,
        rateLimitMs: 100,
      },
    });

    expect(results.summary).toBeDefined();
    expect(typeof results.summary.totalIssues).toBe('number');
    expect(results.summary.bySeverity).toBeDefined();
    expect(results.summary.byCategory).toBeDefined();
  }, 30000);

  it('should respect crawler limits', async () => {
    const registry = new DetectorRegistry();
    registry.register(new JavaScriptErrorsDetector());
    registry.register(new NetworkErrorsDetector());
    registry.register(new BrokenAssetsDetector());
    registry.register(new AccessibilityDetector());
    registry.register(new WebVitalsDetector());
    registry.register(new MixedContentDetector());
    registry.register(new BrokenLinksDetector());

    const scanner = new Scanner(registry);
    
    const results = await scanner.scan({
      url: TEST_SITES.simple,
      screenshots: false,
      crawler: {
        maxDepth: 1,
        maxPages: 1,
        rateLimitMs: 100,
      },
    });

    // Should not exceed maxPages
    expect(results.pages.length).toBeLessThanOrEqual(1);
  }, 30000);

  it('should detect issues consistently', async () => {
    const registry = new DetectorRegistry();
    registry.register(new JavaScriptErrorsDetector());
    registry.register(new NetworkErrorsDetector());
    registry.register(new BrokenAssetsDetector());
    registry.register(new AccessibilityDetector());
    registry.register(new WebVitalsDetector());
    registry.register(new MixedContentDetector());
    registry.register(new BrokenLinksDetector());

    const scanner = new Scanner(registry);
    
    // Run scan twice
    const results1 = await scanner.scan({
      url: TEST_SITES.simple,
      screenshots: false,
      crawler: {
        maxDepth: 1,
        maxPages: 1,
        rateLimitMs: 100,
      },
    });

    const results2 = await scanner.scan({
      url: TEST_SITES.simple,
      screenshots: false,
      crawler: {
        maxDepth: 1,
        maxPages: 1,
        rateLimitMs: 100,
      },
    });

    // Issue counts should be consistent (within reason)
    // Note: Some detectors like web-vitals may have slight variance
    expect(results1.summary.totalIssues).toBeGreaterThanOrEqual(0);
    expect(results2.summary.totalIssues).toBeGreaterThanOrEqual(0);
    
    // Categories should be consistent
    expect(Object.keys(results1.summary.byCategory).sort()).toEqual(
      Object.keys(results2.summary.byCategory).sort()
    );
  }, 60000);
});
