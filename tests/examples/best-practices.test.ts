/**
 * Example test file demonstrating best practices from Playwright and Node.js
 * 
 * Best practices demonstrated:
 * 1. Browser context reuse for performance (30-50% faster)
 * 2. Test isolation via separate pages
 * 3. AAA pattern (Arrange-Act-Assert)
 * 4. Descriptive test names with "should" convention
 * 5. Proper async/await handling (no floating promises)
 * 6. Clean resource management
 */

import { describe, it, expect } from 'vitest';
import { setupBrowserTest } from './helpers/browser.js';
import { JavaScriptErrorsDetector } from '../src/detectors/js-errors.js';

describe('JavaScript Errors Detector - Best Practices Example', () => {
  // Setup browser context (reused across tests for performance)
  const ctx = setupBrowserTest({ headless: true });

  describe('when page has no JavaScript errors', () => {
    it('should report zero issues', async () => {
      // Arrange: Setup detector
      const detector = new JavaScriptErrorsDetector();
      await detector.setup();
      await detector.attach(ctx.page!);

      // Act: Navigate to clean page
      await ctx.page!.goto('https://example.com');
      await ctx.page!.waitForLoadState('networkidle');

      // Assert: Verify no issues detected
      const result = await detector.collect(ctx.page!);
      expect(result.detector).toBe('js-errors');
      expect(result.issues).toHaveLength(0);

      // Cleanup
      await detector.cleanup();
    });
  });

  describe('when page has console errors', () => {
    it('should detect and report console.error calls', async () => {
      // Arrange: Setup detector
      const detector = new JavaScriptErrorsDetector();
      await detector.setup();
      await detector.attach(ctx.page!);

      // Act: Navigate and trigger error
      await ctx.page!.goto('about:blank');
      await ctx.page!.evaluate(() => {
        console.error('Test error message');
      });
      await ctx.page!.waitForTimeout(100); // Give detector time to capture

      // Assert: Verify error detected
      const result = await detector.collect(ctx.page!);
      expect(result.issues.length).toBeGreaterThan(0);
      const errorIssue = result.issues.find(i => 
        i.message.includes('Test error message')
      );
      expect(errorIssue).toBeDefined();
      expect(errorIssue?.severity).toBe('error');

      // Cleanup
      await detector.cleanup();
    });

    it('should detect uncaught exceptions', async () => {
      // Arrange: Setup detector
      const detector = new JavaScriptErrorsDetector();
      await detector.setup();
      await detector.attach(ctx.page!);

      // Act: Navigate and trigger uncaught exception
      await ctx.page!.goto('about:blank');
      
      // Trigger error without catching it
      const errorPromise = ctx.page!.evaluate(() => {
        throw new Error('Uncaught test exception');
      }).catch(() => {
        // Catch in test to prevent test failure, but error is still captured by detector
      });
      
      await errorPromise;
      await ctx.page!.waitForTimeout(100);

      // Assert: Verify exception detected
      const result = await detector.collect(ctx.page!);
      expect(result.issues.length).toBeGreaterThan(0);

      // Cleanup
      await detector.cleanup();
    });
  });

  describe('when detector is disabled', () => {
    it('should not capture errors', async () => {
      // Arrange: Setup detector but don't attach
      const detector = new JavaScriptErrorsDetector();
      await detector.setup();
      // Note: Not calling detector.attach()

      // Act: Navigate and trigger error
      await ctx.page!.goto('about:blank');
      await ctx.page!.evaluate(() => {
        console.error('This should not be captured');
      });
      await ctx.page!.waitForTimeout(100);

      // Assert: Verify no issues since detector wasn't attached
      const result = await detector.collect(ctx.page!);
      expect(result.issues).toHaveLength(0);

      // Cleanup
      await detector.cleanup();
    });
  });
});

/**
 * Example: Parallel test execution pattern
 * 
 * Vitest runs tests in parallel by default within a file.
 * Each test gets its own page (via beforeEach in setupBrowserTest)
 * so they don't interfere with each other.
 */
describe('Parallel Execution Example', () => {
  const ctx = setupBrowserTest();

  // These tests will run in parallel
  it('should handle test 1 - google.com', async () => {
    await ctx.page!.goto('https://google.com');
    expect(await ctx.page!.title()).toBeTruthy();
  });

  it('should handle test 2 - example.com', async () => {
    await ctx.page!.goto('https://example.com');
    expect(await ctx.page!.title()).toBeTruthy();
  });

  it('should handle test 3 - bing.com', async () => {
    await ctx.page!.goto('https://bing.com');
    expect(await ctx.page!.title()).toBeTruthy();
  });
});
