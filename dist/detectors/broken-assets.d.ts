import type { Page } from '@playwright/test';
import { BaseDetector, IssueCategory, type DetectorConfig } from './base.js';
/**
 * Detector for broken assets (images, stylesheets, scripts, fonts)
 */
export declare class BrokenAssetsDetector extends BaseDetector {
    readonly id = "broken-assets";
    readonly name = "Broken Assets";
    readonly description = "Detects broken images, stylesheets, scripts, and fonts";
    readonly category = IssueCategory.ASSETS;
    private readonly assetTypes;
    attach(page: Page, _config?: DetectorConfig): Promise<void>;
}
//# sourceMappingURL=broken-assets.d.ts.map