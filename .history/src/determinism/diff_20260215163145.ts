import type { ScanResults, DetectorResult, Issue } from '../scanner/index.js';

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
export function diffScans(baseline: ScanResults, comparison: ScanResults): ScanDiff {
  const baselineIssues = extractAllIssues(baseline);
  const comparisonIssues = extractAllIssues(comparison);
  
  const added: Issue[] = [];
  const removed: Issue[] = [];
  const unchanged: Issue[] = [];
  
  // Find issues in comparison that weren't in baseline (added)
  for (const issue of comparisonIssues) {
    if (findMatchingIssue(issue, baselineIssues)) {
      unchanged.push(issue);
    } else {
      added.push(issue);
    }
  }
  
  // Find issues in baseline that aren't in comparison (removed)
  for (const issue of baselineIssues) {
    if (!findMatchingIssue(issue, comparisonIssues)) {
      removed.push(issue);
    }
  }
  
  const totalIssues = baselineIssues.length;
  const matchPercentage = totalIssues > 0 
    ? (unchanged.length / totalIssues) * 100 
    : comparisonIssues.length === 0 ? 100 : 0;
  
  return {
    added,
    removed,
    unchanged,
    summary: {
      totalAdded: added.length,
      totalRemoved: removed.length,
      totalUnchanged: unchanged.length,
      matchPercentage,
    },
  };
}

/**
 * Extract all issues from scan results (across all pages)
 */
function extractAllIssues(scan: ScanResults): Issue[] {
  const issues: Issue[] = [];
  
  for (const page of scan.pages) {
    for (const detectorResult of page.detectorResults) {
      issues.push(...detectorResult.issues);
    }
  }
  
  return issues;
}

/**
 * Find a matching issue in an array of issues
 * Issues match if they have the same category, message, and location
 */
function findMatchingIssue(issue: Issue, issues: Issue[]): Issue | undefined {
  return issues.find(i => 
    i.category === issue.category &&
    i.message === issue.message &&
    i.severity === issue.severity &&
    JSON.stringify(i.location) === JSON.stringify(issue.location)
  );
}

/**
 * Format a diff for human-readable output
 */
export function formatDiff(diff: ScanDiff): string {
  const lines: string[] = [];
  
  lines.push('=== Scan Comparison ===\n');
  
  // Summary
  lines.push(`Match Rate: ${diff.summary.matchPercentage.toFixed(1)}%`);
  lines.push(`Unchanged: ${diff.summary.totalUnchanged}`);
  lines.push(`Added: ${diff.summary.totalAdded}`);
  lines.push(`Removed: ${diff.summary.totalRemoved}`);
  lines.push('');
  
  // Added issues
  if (diff.added.length > 0) {
    lines.push('➕ Added Issues:');
    for (const issue of diff.added) {
      lines.push(`   [${issue.severity}] ${issue.category}: ${issue.message}`);
      if (issue.location) {
        lines.push(`      Location: ${JSON.stringify(issue.location)}`);
      }
    }
    lines.push('');
  }
  
  // Removed issues
  if (diff.removed.length > 0) {
    lines.push('➖ Removed Issues:');
    for (const issue of diff.removed) {
      lines.push(`   [${issue.severity}] ${issue.category}: ${issue.message}`);
      if (issue.location) {
        lines.push(`      Location: ${JSON.stringify(issue.location)}`);
      }
    }
    lines.push('');
  }
  
  // Unchanged summary
  if (diff.unchanged.length > 0) {
    lines.push(`✅ ${diff.unchanged.length} issues reproduced successfully`);
  }
  
  return lines.join('\n');
}

/**
 * Compare multiple replay runs and find consistent vs. inconsistent issues
 */
export interface ConsistencyAnalysis {
  alwaysPresent: Issue[];      // Issues found in all runs
  neverPresent: Issue[];        // Issues not found in any run
  inconsistent: Issue[];        // Issues found in some runs but not others
  summary: {
    totalAlwaysPresent: number;
    totalNeverPresent: number;
    totalInconsistent: number;
    consistencyRate: number;
  };
}

export function analyzeConsistency(baseline: ScanResults, replayRuns: ScanResults[]): ConsistencyAnalysis {
  const baselineIssues = extractAllIssues(baseline);
  const alwaysPresent: Issue[] = [];
  const neverPresent: Issue[] = [];
  const inconsistent: Issue[] = [];
  
  for (const issue of baselineIssues) {
    const foundInRuns = replayRuns.filter(run => 
      findMatchingIssue(issue, extractAllIssues(run)) !== undefined
    ).length;
    
    if (foundInRuns === replayRuns.length) {
      alwaysPresent.push(issue);
    } else if (foundInRuns === 0) {
      neverPresent.push(issue);
    } else {
      inconsistent.push(issue);
    }
  }
  
  const totalIssues = baselineIssues.length;
  const consistencyRate = totalIssues > 0 
    ? (alwaysPresent.length / totalIssues) * 100 
    : 100;
  
  return {
    alwaysPresent,
    neverPresent,
    inconsistent,
    summary: {
      totalAlwaysPresent: alwaysPresent.length,
      totalNeverPresent: neverPresent.length,
      totalInconsistent: inconsistent.length,
      consistencyRate,
    },
  };
}
