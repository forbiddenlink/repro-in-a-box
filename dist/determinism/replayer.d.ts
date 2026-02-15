import { Scanner, type ScanResults } from '../scanner/index.js';
export interface ReplayOptions {
    harPath: string;
    url: string;
    scanner: Scanner;
    headless?: boolean;
    outputDir?: string;
}
export interface ReplayResult {
    success: boolean;
    results: ScanResults;
    errors: string[];
    missedRequests: string[];
    fallbackRequests: string[];
}
export interface ValidationOptions {
    bundlePath: string;
    runs?: number;
    outputDir?: string;
}
export interface ValidationResult {
    originalScan: ScanResults;
    replayRuns: ReplayResult[];
    reproducibilityScore: number;
    summary: {
        totalRuns: number;
        successfulRuns: number;
        averageIssuesFound: number;
        consistentIssues: number;
        inconsistentIssues: number;
    };
}
/**
 * Replay a scan using a recorded HAR file
 */
export declare function replayFromHar(options: ReplayOptions): Promise<ReplayResult>;
/**
 * Validate reproducibility by replaying multiple times and comparing
 */
export declare function validateReproducibility(options: ValidationOptions): Promise<ValidationResult>;
//# sourceMappingURL=replayer.d.ts.map