import type { Page } from '@playwright/test';
import { BaseDetector, IssueCategory, type DetectorConfig, type Issue } from './base.js';
/**
 * Detector for accessibility issues using axe-core
 */
export declare class AccessibilityDetector extends BaseDetector {
    readonly id = "accessibility";
    readonly name = "Accessibility";
    readonly description = "Detects WCAG 2.1 Level A & AA accessibility violations using axe-core";
    readonly category = IssueCategory.ACCESSIBILITY;
    attach(_page: Page, _config?: DetectorConfig): Promise<void>;
    scan(page: Page, _config?: DetectorConfig): Promise<Issue[]>;
}
//# sourceMappingURL=accessibility.d.ts.map