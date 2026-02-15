import type { Page } from '@playwright/test';
import { BaseDetector, IssueCategory, type DetectorConfig } from './base.js';
/**
 * Detector for mixed content issues (HTTP resources on HTTPS pages)
 */
export declare class MixedContentDetector extends BaseDetector {
    readonly id = "mixed-content";
    readonly name = "Mixed Content";
    readonly description = "Detects insecure HTTP resources loaded on HTTPS pages";
    readonly category = IssueCategory.SECURITY;
    attach(page: Page, _config?: DetectorConfig): Promise<void>;
}
//# sourceMappingURL=mixed-content.d.ts.map