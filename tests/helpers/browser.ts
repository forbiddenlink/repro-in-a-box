/**
 * Test utilities for browser-based tests in Vitest
 * Provides patterns for optimal browser context management
 * 
 * Pattern:
 * - Browser: suite-scoped (one per describe block, reused across tests)
 * - Page: test-scoped (new page per test for isolation)
 * 
 * Benefits:
 * - 30-50% faster than creating new browser per test
 * - Proper test isolation via separate pages
 * - Clean storage/cookies state per test
 */

import { chromium, type Browser, type Page, type BrowserContext } from '@playwright/test';
import { afterAll, beforeAll, beforeEach, afterEach } from 'vitest';

/**
 * Browser test context with automatic cleanup
 */
export interface BrowserTestContext {
  browser: Browser;
  context?: BrowserContext;
  page?: Page;
}

/**
 * Setup browser context for a test suite with optimal performance pattern
 * 
 * Usage:
 * ```typescript
 * describe('My Test Suite', () => {
 *   const ctx = setupBrowserTest();
 *   
 *   it('should work', async () => {
 *     await ctx.page!.goto('https://example.com');
 *     // Test logic
 *   });
 * });
 * ```
 * 
 * @param options - Browser launch options
 * @returns Test context with browser and page
 */
export function setupBrowserTest(options?: {
  headless?: boolean;
  contextOptions?: Record<string, unknown>;
}): BrowserTestContext {
  const ctx: BrowserTestContext = { browser: undefined! };

  // Suite-scoped browser (reused across all tests in describe block)
  beforeAll(async () => {
    ctx.browser = await chromium.launch({
      headless: options?.headless ?? true,
    });
  });

  // Test-scoped context and page (new for each test)
  beforeEach(async () => {
    ctx.context = await ctx.browser.newContext({
      viewport: { width: 1280, height: 720 },
      ...options?.contextOptions,
    });
    ctx.page = await ctx.context.newPage();
  });

  // Clean up after each test
  afterEach(async () => {
    if (ctx.page) {
      await ctx.page.close();
      ctx.page = undefined;
    }
    if (ctx.context) {
      await ctx.context.close();
      ctx.context = undefined;
    }
  });

  // Clean up browser after all tests
  afterAll(async () => {
    if (ctx.browser) {
      await ctx.browser.close();
    }
  });

  return ctx;
}

/**
 * Setup browser with shared page (legacy pattern, use setupBrowserTest for better isolation)
 * Only use this when you need to share page state across multiple tests.
 * 
 * @deprecated Prefer setupBrowserTest for better test isolation
 */
export function setupSharedBrowserTest(options?: {
  headless?: boolean;
}): BrowserTestContext {
  const ctx: BrowserTestContext = { browser: undefined! };

  beforeAll(async () => {
    ctx.browser = await chromium.launch({
      headless: options?.headless ?? true,
    });
    const context = await ctx.browser.newContext();
    ctx.page = await context.newPage();
  });

  afterAll(async () => {
    if (ctx.page) {
      await ctx.page.close();
    }
    await ctx.browser.close();
  });

  return ctx;
}

/**
 * Clear browser context state (cookies, storage) between tests
 * Use when you need to share a page but want clean state
 */
export async function clearBrowserState(page: Page, context?: BrowserContext): Promise<void> {
  if (context) {
    await context.clearCookies();
  }
  
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  }).catch(() => {
    // Ignore if page context not available
  });
}
