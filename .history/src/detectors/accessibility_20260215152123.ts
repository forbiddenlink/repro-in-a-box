import type { Page } from '@playwright/test';
import { injectAxe, checkA11y, getViolations } from 'axe-playwright';
import { BaseDetector, IssueCategory, IssueSeverity, type DetectorConfig, type Issue } from './base.js';

/**
 * Detector for accessibility issues using axe-core
 */
export class AccessibilityDetector extends BaseDetector {
  readonly id = 'accessibility';
  readonly name = 'Accessibility';
  readonly description = 'Detects WCAG 2.1 Level A & AA accessibility violations using axe-core';
  readonly category = IssueCategory.ACCESSIBILITY;
  
  private axeInjected = false;
  
  async attach(page: Page, _config?: DetectorConfig): Promise<void> {
    // Inject axe-core into the page
    try {
      await injectAxe(page);
      this.axeInjected = true;
    } catch (error) {
      console.error('Failed to inject axe-core:', error);
      this.axeInjected = false;
    }
  }
  
  async scan(page: Page, _config?: DetectorConfig): Promise<Issue[]> {
    if (!this.axeInjected) {
      return [];
    }
    
    try {
      // Get violations directly without throwing
      const accessibilityScanResults = await page.evaluate(() => {
        // @ts-expect-error - axe is injected globally
        return globalThis.axe.run();
      });
      
      const violations = accessibilityScanResults.violations || [];
      
      // Convert axe violations to our issue format
      for (const violation of violations) {
        // Map axe impact to our severity
        let severity: IssueSeverity;
        switch (violation.impact) {
          case 'critical':
            severity = IssueSeverity.CRITICAL;
            break;
          case 'serious':
            severity = IssueSeverity.ERROR;
            break;
          case 'moderate':
            severity = IssueSeverity.WARNING;
            break;
          case 'minor':
            severity = IssueSeverity.INFO;
            break;
          default:
            severity = IssueSeverity.WARNING;
        }
        
        // Create an issue for each violation
        // Each violation can have multiple nodes affected
        for (const node of violation.nodes) {
          this.addIssue(
            this.createIssue(
              `a11y-${violation.id}`,
              `${violation.help}: ${node.failureSummary || violation.description}`,
              severity,
              page.url(),
              {
                selector: node.target.join(', '),
                details: JSON.stringify({
                  id: violation.id,
                  impact: violation.impact,
                  tags: violation.tags,
                  help: violation.help,
                  helpUrl: violation.helpUrl,
                  html: node.html,
                  failureSummary: node.failureSummary,
                }, null, 2)
              }
            )
          );
        }
      }
      
      return this.issues;
    } catch (error) {
      console.error('Accessibility scan failed:', error);
      return this.issues;
    }
  }
}
