import type { ScanResults } from '../scanner/index.js';
export interface BundleOptions {
    scanResults: ScanResults;
    outputDir: string;
    outputName?: string;
    harPath?: string;
}
export interface BundleResult {
    bundlePath: string;
    size: number;
    contents: string[];
}
/**
 * Creates a reproducible bundle (ZIP) containing:
 * - Scan results JSON
 * - HAR file (if available)
 * - Screenshots (if available)
 * - Reproduction script
 */
export declare function createBundle(options: BundleOptions): Promise<BundleResult>;
//# sourceMappingURL=index.d.ts.map