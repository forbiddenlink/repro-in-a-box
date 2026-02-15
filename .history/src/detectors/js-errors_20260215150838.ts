import type { Page } from '@playwright/test';
import { BaseDetector, IssueCategory, IssueSeverity, type DetectorConfig } from './base.js';

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
      (window as any).__reproUnhandledRejections = [];
      window.addEventListener('unhandledrejection', (event: any) => {
        (window as any).__reproUnhandledRejections.push({
          reason: event.reason?.toString() || 'Unknown rejection',
          stack: event.reason?.stack || '',
          timestamp: Date.now()
        });
      });
    });
  }
  
  async scan(page: Page, _config?: DetectorConfig): Promise<any[]> {
    // Retrieve unhandled rejections from the page
    const rejections = await page.evaluate(() => {
      return (window as any).__reproUnhandledRejections || [];
    });
    
    // Convert to issues
    const issues = rejections.map((rejection: any) => 
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
    issues.forEach(issue => this.addIssue(issue));
    
    return issues;
  }
}
