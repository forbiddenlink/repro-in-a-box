import type { Page } from '@playwright/test';
import { injectAxe } from 'axe-playwright';
import { BaseDetector, IssueCategory, IssueSeverity, type DetectorConfig, type Issue } from './base.js';

/** Axe-core result types */
interface AxeNode {
  target: string[];
  html: string;
  failureSummary?: string;
}

interface AxeViolation {
  id: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor' | null;
  tags: string[];
  description: string;
  help: string;
  helpUrl: string;
  nodes: AxeNode[];
}

interface AxeResults {
  violations: AxeViolation[];
}

/**
 * Detector for accessibility issues using axe-core
 */
export class AccessibilityDetector extends BaseDetector {
  readonly id = 'accessibility';
  readonly name = 'Accessibility';
  readonly description = 'Detects WCAG 2.1 Level A & AA accessibility violations using axe-core';
  readonly category = IssueCategory.ACCESSIBILITY;

  async attach(_page: Page, _config?: DetectorConfig): Promise<void> {
    // No setup needed - axe will be injected on each scan
  }

  async scan(page: Page, _config?: DetectorConfig): Promise<Issue[]> {
    try {
      // Inject axe-core before each scan since page context resets on navigation
      await injectAxe(page);

      // Get violations directly without throwing
      const accessibilityScanResults = await page.evaluate(() => {
        // @ts-expect-error - axe is injected globally
        return globalThis.axe.run() as Promise<AxeResults>;
      }) as AxeResults;

      const violations: AxeViolation[] = accessibilityScanResults.violations || [];

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
              `${violation.help}: ${node.failureSummary ?? violation.description}`,
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
