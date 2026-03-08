import type { Page } from '@playwright/test';
import { BaseDetector, IssueCategory, IssueSeverity, type DetectorConfig, type Issue } from './base.js';

/**
 * Detector for JavaScript errors, console errors, and unhandled rejections
 */
export class JavaScriptErrorsDetector extends BaseDetector {
  readonly id = 'js-errors';
  readonly name = 'JavaScript Errors';
  readonly description = 'Detects JavaScript errors, console errors, and unhandled promise rejections';
  readonly category = IssueCategory.JAVASCRIPT;
  
  async attach(page: Page, _config?: DetectorConfig): Promise<void> {
    // Listen for uncaught exceptions
    page.on('pageerror', (error) => {
      this.addIssue(
        this.createIssue(
          'js-error',
          `Uncaught exception: ${error.message}`,
          IssueSeverity.ERROR,
          page.url(),
          {
            details: error.stack
          }
        )
      );
    });
    
    // Listen for console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        this.addIssue(
          this.createIssue(
            'console-error',
            `Console error: ${msg.text()}`,
            IssueSeverity.WARNING,
            page.url(),
            {
              details: msg.location().url
            }
          )
        );
      }
    });
    
    // Inject script to capture unhandled rejections
    await page.addInitScript(() => {
      /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
      (globalThis as any).__reproUnhandledRejections = [];
      (globalThis as any).addEventListener('unhandledrejection', (event: any) => {
        (globalThis as any).__reproUnhandledRejections.push({
          reason: event.reason?.toString() || 'Unknown rejection',
          stack: event.reason?.stack || '',
          timestamp: Date.now()
        });
        /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
      });
    });
  }
  
  async scan(page: Page, _config?: DetectorConfig): Promise<Issue[]> {
    // Retrieve unhandled rejections from the page
    const rejections = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      return ((globalThis as any).__reproUnhandledRejections || []) as Array<{
        reason: string;
        stack: string;
        timestamp: number;
      }>;
    });
    
    // Convert to issues
    const issues = rejections.map((rejection) => 
      this.createIssue(
        'unhandled-rejection',
        `Unhandled promise rejection: ${rejection.reason}`,
        IssueSeverity.ERROR,
        page.url(),
        {
          details: rejection.stack
        }
      )
    );
    
    // Add to our collection
    issues.forEach((issue) => this.addIssue(issue));
    
    return issues;
  }
}
