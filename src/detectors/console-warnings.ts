import type { Page, ConsoleMessage } from '@playwright/test';
import { BaseDetector, IssueCategory, IssueSeverity, type DetectorConfig, type Issue } from './base.js';

/**
 * Console message patterns for common framework warnings
 */
const FRAMEWORK_PATTERNS = {
  react: [
    /Warning: Each child in a list should have a unique "key" prop/,
    /Warning: Can't perform a React state update on an unmounted component/,
    /Warning: componentWillMount has been renamed/,
    /Warning: componentWillReceiveProps has been renamed/,
    /Warning: componentWillUpdate has been renamed/,
    /Warning: React does not recognize the .* prop/,
    /Warning: Invalid DOM property/,
    /Warning: Received .* for a non-boolean attribute/,
  ],
  vue: [
    /\[Vue warn\]/,
    /Property .* was accessed during render but is not defined/,
    /Avoid mutating a prop directly/,
  ],
  angular: [
    /ExpressionChangedAfterItHasBeenCheckedError/,
    /Can't bind to .* since it isn't a known property/,
  ],
  general: [
    /deprecated/i,
    /will be removed in/i,
    /is no longer supported/i,
  ],
};

/**
 * Detector for console warnings separate from errors
 */
export class ConsoleWarningsDetector extends BaseDetector {
  readonly id = 'console-warnings';
  readonly name = 'Console Warnings';
  readonly description = 'Detects console warnings, deprecations, and framework-specific issues';
  readonly category = IssueCategory.CONSOLE;

  private warnings: Array<{ message: string; type: string; url: string }> = [];

  attach(page: Page, _config?: DetectorConfig): Promise<void> {
    // Listen for console messages
    page.on('console', (msg: ConsoleMessage) => {
      const type = msg.type();
      const text = msg.text();

      // Only capture warnings (not errors - those are handled by js-errors detector)
      if (type === 'warning' || type === 'info') {
        this.warnings.push({
          message: text,
          type,
          url: page.url(),
        });
      }
    });

    return Promise.resolve();
  }

  async scan(page: Page, _config?: DetectorConfig): Promise<Issue[]> {
    // Process collected warnings
    for (const warning of this.warnings) {
      const severity = this.categorizeWarning(warning.message);
      const framework = this.detectFramework(warning.message);

      this.addIssue(
        this.createIssue(
          `console-${warning.type}${framework ? `-${framework}` : ''}`,
          warning.message.slice(0, 200) + (warning.message.length > 200 ? '...' : ''),
          severity,
          warning.url,
          {
            details: JSON.stringify({
              fullMessage: warning.message,
              type: warning.type,
              framework,
              isDeprecation: /deprecated|will be removed/i.test(warning.message),
            }, null, 2),
          }
        )
      );
    }

    return this.issues;
  }

  /**
   * Categorize warning severity based on content
   */
  private categorizeWarning(message: string): IssueSeverity {
    // Deprecation warnings are more important
    if (/deprecated|will be removed|is no longer supported/i.test(message)) {
      return IssueSeverity.WARNING;
    }

    // Framework-specific warnings about state/performance
    if (/state update on an unmounted|ExpressionChangedAfterItHasBeenCheckedError/i.test(message)) {
      return IssueSeverity.WARNING;
    }

    // Key prop warnings
    if (/unique "key" prop/i.test(message)) {
      return IssueSeverity.INFO;
    }

    return IssueSeverity.INFO;
  }

  /**
   * Detect which framework generated the warning
   */
  private detectFramework(message: string): string | null {
    for (const pattern of FRAMEWORK_PATTERNS.react) {
      if (pattern.test(message)) return 'react';
    }
    for (const pattern of FRAMEWORK_PATTERNS.vue) {
      if (pattern.test(message)) return 'vue';
    }
    for (const pattern of FRAMEWORK_PATTERNS.angular) {
      if (pattern.test(message)) return 'angular';
    }
    return null;
  }

  async cleanup(): Promise<void> {
    await super.cleanup();
    this.warnings = [];
  }
}
