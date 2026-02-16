/**
 * Test fixtures for Playwright-based tests
 * Implements worker-scoped browser context pattern for optimal performance
 * 
 * Pattern based on Playwright best practices:
 * - Browser: worker-scoped (one per test worker)
 * - Context: test-scoped (isolated per test)
 * - Page: test-scoped (isolated per test)
 * 
 * Benefits:
 * - 30-50% faster test execution vs creating new browser per test
 * - Proper test isolation via separate contexts
 * - Automatic cleanup via fixtures
 */

import { test as base, expect, Browser, BrowserContext, Page } from '@playwright/test';
import { chromium } from '@playwright/test';

/**
 * Extended test fixtures with worker-scoped browser
 */
type TestFixtures = {
  /** Test-scoped browser context (isolated per test) */
  context: BrowserContext;
  /** Test-scoped page (isolated per test) */
  page: Page;
};

type WorkerFixtures = {
  /** Worker-scoped browser (shared across tests in same worker) */
  browser: Browser;
};

/**
 * Test with custom fixtures for optimal performance
 * 
 * Usage:
 * ```typescript
 * import { test, expect } from './fixtures';
 * 
 * test('should detect broken links', async ({ page }) => {
 *   await page.goto('https://example.com');
 *   // Test logic
 * });
 * ```
 */
export const test = base.extend<TestFixtures, WorkerFixtures>({
  // Worker-scoped browser: launched once per worker, reused across tests
  browser: [async ({}, use) => {
    const browser = await chromium.launch({
      headless: true,
    });
    await use(browser);
    await browser.close();
  }, { scope: 'worker' }],

  // Test-scoped context: new clean context for each test
  context: async ({ browser }, use) => {
    const context = await browser.newContext({
      // Context options for test isolation
      viewport: { width: 1280, height: 720 },
      // Each test gets clean cookies/storage
      storageState: undefined,
    });
    await use(context);
    await context.close();
  },

  // Test-scoped page: new clean page for each test
  page: async ({ context }, use) => {
    const page = await context.newPage();
    await use(page);
    await page.close();
  },
});

/**
 * Export expect for convenience
 */
export { expect };

/**
 * Example: Custom fixture with detector setup
 * 
 * You can extend fixtures further for detector-specific setup:
 * ```typescript
 * export const detectorTest = test.extend<{ detector: BrokenLinksDetector }>({
 *   detector: async ({}, use) => {
 *     const detector = new BrokenLinksDetector();
 *     await detector.setup();
 *     await use(detector);
 *     await detector.cleanup();
 *   },
 * });
 * ```
 */
