import type { Page } from '@playwright/test';
import { BaseDetector, IssueCategory, type DetectorConfig, type Issue } from './base.js';
/**
 * Detector for broken internal and external links
 */
export declare class BrokenLinksDetector extends BaseDetector {
    readonly id = "broken-links";
    readonly name = "Broken Links";
    readonly description = "Detects broken internal and external links on the page";
    readonly category = IssueCategory.LINKS;
    private checkedLinks;
    attach(page: Page, _config?: DetectorConfig): Promise<void>;
    scan(page: Page, _config?: DetectorConfig): Promise<Issue[]>;
    cleanup(): Promise<void>;
}
//# sourceMappingURL=broken-links.d.ts.map