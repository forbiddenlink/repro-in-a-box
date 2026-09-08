import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Scanner } from '../src/scanner/index.js';
import { DetectorRegistry } from '../src/detectors/registry.js';
import { IssueCategory, type Detector } from '../src/detectors/base.js';

const browser = vi.hoisted(() => {
  const page = {
    goto: vi.fn(),
    evaluate: vi.fn().mockResolvedValue(undefined),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };
  const context = {
    newPage: vi.fn().mockResolvedValue(page),
    clearCookies: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };
  return {
    page,
    context,
    newContext: vi.fn().mockResolvedValue(context),
    close: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('@playwright/test', () => ({
  chromium: { launch: vi.fn().mockResolvedValue(browser) },
}));

const url = 'https://example.invalid/';

function createDetector(): Detector {
  return {
    id: 'test',
    name: 'Test detector',
    description: 'Synthetic detector',
    category: IssueCategory.CUSTOM,
    attach: vi.fn().mockResolvedValue(undefined),
    scan: vi.fn().mockResolvedValue([]),
    collect: vi.fn().mockResolvedValue({
      detector: 'test', url, startTime: 0, endTime: 0, duration: 0, issues: [],
    }),
    cleanup: vi.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  browser.page.goto.mockResolvedValue({ status: () => 200 });
});

describe('scan failure propagation', () => {
  it.each(['navigation', 'scan', 'collect'] as const)(
    'rejects %s failures instead of returning a clean scan',
    async (stage) => {
      const failure = new Error(`${stage} failed`);
      const detector = createDetector();
      if (stage === 'navigation') browser.page.goto.mockRejectedValueOnce(failure);
      else if (stage === 'scan') detector.scan = vi.fn().mockRejectedValueOnce(failure);
      else detector.collect = vi.fn().mockRejectedValueOnce(failure);
      const registry = new DetectorRegistry();
      registry.register(detector);
      const onError = vi.fn();
      const afterScan = vi.fn();

      await expect(new Scanner(registry).scan({
        url,
        crawler: { maxDepth: 0, maxPages: 1, rateLimitMs: 0 },
        assetBlocking: { enabled: false },
        progressFormat: 'minimal',
        hooks: { onError, afterScan },
      })).rejects.toThrow(`${stage} failed`);

      expect(onError).toHaveBeenCalledOnce();
      expect(afterScan).not.toHaveBeenCalled();
      expect(detector.cleanup).toHaveBeenCalledOnce();
      expect(browser.page.close).toHaveBeenCalledOnce();
      expect(browser.context.close).toHaveBeenCalledOnce();
      expect(browser.close).toHaveBeenCalledOnce();
    },
  );

  it('still returns successful empty results when the page and detectors succeed', async () => {
    const registry = new DetectorRegistry();
    registry.register(createDetector());
    const results = await new Scanner(registry).scan({
      url,
      crawler: { maxDepth: 0, maxPages: 1, rateLimitMs: 0 },
      assetBlocking: { enabled: false },
      progressFormat: 'minimal',
    });
    expect(results.summary).toMatchObject({ pagesScanned: 1, totalIssues: 0 });
  });
});
