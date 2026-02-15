import type { Page } from '@playwright/test';
import { BaseDetector, IssueCategory, type DetectorConfig } from './base.js';
/**
 * Detector for network request failures, timeouts, and errors
 */
export declare class NetworkErrorsDetector extends BaseDetector {
    readonly id = "network-errors";
    readonly name = "Network Errors";
    readonly description = "Detects failed HTTP requests, timeouts, and network errors";
    readonly category = IssueCategory.NETWORK;
    attach(page: Page, _config?: DetectorConfig): Promise<void>;
}
//# sourceMappingURL=network-errors.d.ts.map