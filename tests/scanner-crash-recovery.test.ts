import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Scanner } from '../src/scanner/index.js';
import { DetectorRegistry } from '../src/detectors/registry.js';
import { IssueCategory, type Detector } from '../src/detectors/base.js';

const ROOT = 'https://example.invalid/';
const GONE = 'browserContext.close: Target page, context or browser has been closed';

const browser = vi.hoisted(() => {
  const makePage = () => ({
    goto: vi.fn(),
    evaluate: vi.fn().mockResolvedValue(undefined),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    $$eval: vi.fn().mockResolvedValue([]),
    setDefaultTimeout: vi.fn(),
    setDefaultNavigationTimeout: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  });
  const context = {
    newPage: vi.fn(),
    clearCookies: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };
  return {
    makePage,
    pages: [] as ReturnType<typeof makePage>[],
    context,
    newContext: vi.fn().mockResolvedValue(context),
    close: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('@playwright/test', () => ({
  chromium: { launch: vi.fn().mockResolvedValue(browser) },
}));

function createDetector(): Detector {
  return {
    id: 'test',
    name: 'Test detector',
    description: 'Synthetic detector',
    category: IssueCategory.CUSTOM,
    attach: vi.fn().mockResolvedValue(undefined),
    scan: vi.fn().mockResolvedValue([]),
    collect: vi.fn().mockResolvedValue({
      detector: 'test', url: ROOT, startTime: 0, endTime: 0, duration: 0, issues: [],
    }),
    cleanup: vi.fn().mockResolvedValue(undefined),
  };
}

function runScan(extra: Record<string, unknown> = {}) {
  const registry = new DetectorRegistry();
  registry.register(createDetector());
  return new Scanner(registry).scan({
    url: ROOT,
    crawler: { maxDepth: 1, maxPages: 5, rateLimitMs: 0 },
    assetBlocking: { enabled: false },
    progressFormat: 'minimal',
    ...extra,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  browser.pages = [];
  browser.context.newPage.mockImplementation(() => {
    const page = browser.makePage();
    page.goto.mockResolvedValue({ status: () => 200 });
    browser.pages.push(page);
    return Promise.resolve(page);
  });
  browser.context.close.mockResolvedValue(undefined);
  browser.close.mockResolvedValue(undefined);
});

describe('page crash recovery', () => {
  it('records a crashed page as a finding and continues on a fresh page', async () => {
    browser.context.newPage.mockImplementationOnce(() => {
      const page = browser.makePage();
      page.$$eval.mockResolvedValue([`${ROOT}a`, `${ROOT}b`]);
      page.goto
        .mockResolvedValueOnce({ status: () => 200 })
        .mockRejectedValueOnce(new Error('page.goto: Page crashed'));
      browser.pages.push(page);
      return Promise.resolve(page);
    });

    const results = await runScan();

    const urls = results.pages.map((p) => p.url);
    expect(urls).toEqual([ROOT, `${ROOT}a`, `${ROOT}b`]);
    const crashed = results.pages[1].detectorResults.flatMap((r) => r.issues);
    expect(crashed).toHaveLength(1);
    expect(crashed[0]).toMatchObject({ type: 'page-crash', severity: 'error', url: `${ROOT}a` });
    expect(results.summary.totalIssues).toBe(1);
    // The crashed page was replaced, and the next URL loaded on the replacement.
    expect(browser.pages.length).toBeGreaterThanOrEqual(2);
    expect(browser.pages[browser.pages.length - 1].goto).toHaveBeenCalledWith(`${ROOT}b`, expect.anything());
  });

  it('still rejects non-crash navigation failures', async () => {
    browser.context.newPage.mockImplementationOnce(() => {
      const page = browser.makePage();
      page.goto.mockRejectedValueOnce(new Error('net::ERR_NAME_NOT_RESOLVED'));
      browser.pages.push(page);
      return Promise.resolve(page);
    });
    await expect(runScan()).rejects.toThrow('ERR_NAME_NOT_RESOLVED');
  });
});

describe('cleanup', () => {
  it('never throws when page, context and browser are already gone', async () => {
    browser.context.newPage.mockImplementationOnce(() => {
      const page = browser.makePage();
      page.goto.mockResolvedValue({ status: () => 200 });
      page.close.mockRejectedValue(new Error(GONE));
      browser.pages.push(page);
      return Promise.resolve(page);
    });
    browser.context.close.mockRejectedValue(new Error(GONE));
    browser.close.mockRejectedValue(new Error(GONE));

    const results = await runScan({ crawler: { maxDepth: 0, maxPages: 1, rateLimitMs: 0 } });
    expect(results.summary.pagesScanned).toBe(1);
  });

  it('does not mask the scan error with a cleanup error', async () => {
    browser.context.newPage.mockImplementationOnce(() => {
      const page = browser.makePage();
      page.goto.mockRejectedValue(new Error('net::ERR_FAILED'));
      page.close.mockRejectedValue(new Error(GONE));
      browser.pages.push(page);
      return Promise.resolve(page);
    });
    browser.close.mockRejectedValue(new Error(GONE));
    await expect(runScan()).rejects.toThrow('ERR_FAILED');
  });
});

describe('global scan deadline', () => {
  it('stops a hung scan, returns partial results and closes the browser', async () => {
    browser.context.newPage.mockImplementationOnce(() => {
      const page = browser.makePage();
      // Never settles on its own; only closing the browser releases it.
      page.goto.mockImplementation(
        () => new Promise((_, reject) => {
          browser.close.mockImplementationOnce(() => {
            reject(new Error('Target closed'));
            return Promise.resolve();
          });
        }),
      );
      browser.pages.push(page);
      return Promise.resolve(page);
    });

    const started = Date.now();
    const results = await runScan({ timeouts: { scan: 200 } });
    expect(Date.now() - started).toBeLessThan(5000);
    expect(results.summary.pagesScanned).toBe(0);
    expect(results.deadlineExceeded).toBe(true);
    expect(browser.close).toHaveBeenCalled();
  });
});
