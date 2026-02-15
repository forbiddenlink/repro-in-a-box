import type { ScanResults } from '../scanner/index.js';
import type { Issue } from '../detectors/base.js';
export interface ScanDiff {
    added: Issue[];
    removed: Issue[];
    unchanged: Issue[];
    summary: {
        totalAdded: number;
        totalRemoved: number;
        totalUnchanged: number;
        matchPercentage: number;
    };
}
/**
 * Compare two scan results and return differences
 */
export declare function diffScans(baseline: ScanResults, comparison: ScanResults): ScanDiff;
/**
 * Format a diff for human-readable output
 */
export declare function formatDiff(diff: ScanDiff): string;
/**
 * Compare multiple replay runs and find consistent vs. inconsistent issues
 */
export interface ConsistencyAnalysis {
    alwaysPresent: Issue[];
    neverPresent: Issue[];
    inconsistent: Issue[];
    summary: {
        totalAlwaysPresent: number;
        totalNeverPresent: number;
        totalInconsistent: number;
        consistencyRate: number;
    };
}
export declare function analyzeConsistency(baseline: ScanResults, replayRuns: ScanResults[]): ConsistencyAnalysis;
//# sourceMappingURL=diff.d.ts.map