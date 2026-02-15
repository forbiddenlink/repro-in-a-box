import type { Page } from '@playwright/test';
import { BaseDetector, IssueCategory, type DetectorConfig } from './base.js';
/**
 * Detector for JavaScript errors, console errors, and unhandled rejections
 */
export declare class JavaScriptErrorsDetector extends BaseDetector {
    readonly id = "js-errors";
    readonly name = "JavaScript Errors";
    readonly description = "Detects JavaScript errors, console errors, and unhandled promise rejections";
    readonly category = IssueCategory.JAVASCRIPT;
    attach(page: Page, _config?: DetectorConfig): Promise<void>;
    scan(page: Page, _config?: DetectorConfig): Promise<any[]>;
}
//# sourceMappingURL=js-errors.d.ts.map