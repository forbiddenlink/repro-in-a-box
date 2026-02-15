import { describe, it, expect } from 'vitest';
import { diffScans, analyzeConsistency, formatDiff } from '../diff.js';
import type { ScanResults } from '../../scanner/index.js';
import { IssueSeverity, IssueCategory } from '../../detectors/base.js';

describe('diffScans', () => {
  const createMockScanResults = (issueCount: number): ScanResults => ({
    timestamp: new Date().toISOString(),
    url: 'https://example.com',
    config: { url: 'https://example.com', headless: true },
    pages: [{
      url: 'https://example.com',
      depth: 0,
      detectorResults: [{
        detectorId: 'test-detector',
        issues: Array.from({ length: issueCount }, (_, i) => ({
          type: 'test-issue',
          message: `Issue ${i}`,
          severity: IssueSeverity.ERROR,
          category: IssueCategory.JAVASCRIPT,
          url: 'https://example.com',
          timestamp: Date.now(),
        })),
      }],
      summary: {
        totalIssues: issueCount,
        byCategory: { [IssueCategory.JAVASCRIPT]: issueCount },
        bySeverity: { [IssueSeverity.ERROR]: issueCount },
      },
    }],
    summary: {
      pagesScanned: 1,
      totalIssues: issueCount,
      duration: '1s',
      byCategory: { [IssueCategory.JAVASCRIPT]: issueCount },
      bySeverity: { [IssueSeverity.ERROR]: issueCount },
    },
  });

  it('should detect when scans are identical', () => {
    const baseline = createMockScanResults(2);
    const comparison = createMockScanResults(2);

    const diff = diffScans(baseline, comparison);

    expect(diff.summary.totalAdded).toBe(0);
    expect(diff.summary.totalRemoved).toBe(0);
    expect(diff.summary.totalUnchanged).toBe(2);
    expect(diff.summary.matchPercentage).toBe(100);
  });

  it('should detect added issues', () => {
    const baseline = createMockScanResults(1);
    const comparison = createMockScanResults(3);

    const diff = diffScans(baseline, comparison);

    expect(diff.summary.totalAdded).toBe(2);
    expect(diff.summary.totalUnchanged).toBe(1);
    expect(diff.summary.matchPercentage).toBe(100); // All baseline issues still present
  });

  it('should detect removed issues', () => {
    const baseline = createMockScanResults(3);
    const comparison = createMockScanResults(1);

    const diff = diffScans(baseline, comparison);

    expect(diff.summary.totalRemoved).toBe(2);
    expect(diff.summary.totalUnchanged).toBe(1);
    expect(diff.summary.matchPercentage).toBeCloseTo(33.33, 1);
  });

  it('should handle zero-issue scans', () => {
    const baseline = createMockScanResults(0);
    const comparison = createMockScanResults(0);

    const diff = diffScans(baseline, comparison);

    expect(diff.summary.totalAdded).toBe(0);
    expect(diff.summary.totalRemoved).toBe(0);
    expect(diff.summary.matchPercentage).toBe(100);
  });

  it('should handle baseline with issues, comparison with none', () => {
    const baseline = createMockScanResults(5);
    const comparison = createMockScanResults(0);

    const diff = diffScans(baseline, comparison);

    expect(diff.summary.totalRemoved).toBe(5);
    expect(diff.summary.totalUnchanged).toBe(0);
    expect(diff.summary.matchPercentage).toBe(0);
  });
});

describe('analyzeConsistency', () => {
  const createMockScanResults = (issueIds: number[]): ScanResults => ({
    timestamp: new Date().toISOString(),
    url: 'https://example.com',
    config: { url: 'https://example.com', headless: true },
    pages: [{
      url: 'https://example.com',
      depth: 0,
      detectorResults: [{
        detectorId: 'test-detector',
        issues: issueIds.map(id => ({
          type: 'test-issue',
          message: `Issue ${id}`,
          severity: IssueSeverity.ERROR,
          category: IssueCategory.JAVASCRIPT,
          url: 'https://example.com',
          timestamp: Date.now(),
        })),
      }],
      summary: {
        totalIssues: issueIds.length,
        byCategory: { [IssueCategory.JAVASCRIPT]: issueIds.length },
        bySeverity: { [IssueSeverity.ERROR]: issueIds.length },
      },
    }],
    summary: {
      pagesScanned: 1,
      totalIssues: issueIds.length,
      duration: '1s',
      byCategory: { [IssueCategory.JAVASCRIPT]: issueIds.length },
      bySeverity: { [IssueSeverity.ERROR]: issueIds.length },
    },
  });

  it('should identify always-present issues', () => {
    const baseline = createMockScanResults([1, 2, 3]);
    const runs = [
      createMockScanResults([1, 2, 3]),
      createMockScanResults([1, 2, 3]),
      createMockScanResults([1, 2, 3]),
    ];

    const analysis = analyzeConsistency(baseline, runs);

    expect(analysis.summary.totalAlwaysPresent).toBe(3);
    expect(analysis.summary.totalNeverPresent).toBe(0);
    expect(analysis.summary.totalInconsistent).toBe(0);
    expect(analysis.summary.consistencyRate).toBe(100);
  });

  it('should identify never-present issues', () => {
    const baseline = createMockScanResults([1, 2, 3]);
    const runs = [
      createMockScanResults([]),
      createMockScanResults([]),
      createMockScanResults([]),
    ];

    const analysis = analyzeConsistency(baseline, runs);

    expect(analysis.summary.totalAlwaysPresent).toBe(0);
    expect(analysis.summary.totalNeverPresent).toBe(3);
    expect(analysis.summary.consistencyRate).toBe(0);
  });

  it('should identify inconsistent issues', () => {
    const baseline = createMockScanResults([1, 2, 3]);
    const runs = [
      createMockScanResults([1, 2]),    // Issue 3 missing
      createMockScanResults([1, 2, 3]), // All present
      createMockScanResults([1]),       // Issues 2, 3 missing
    ];

    const analysis = analyzeConsistency(baseline, runs);

    expect(analysis.summary.totalAlwaysPresent).toBe(1); // Issue 1 always present
    expect(analysis.summary.totalNeverPresent).toBe(0);
    expect(analysis.summary.totalInconsistent).toBe(2); // Issues 2, 3 inconsistent
    expect(analysis.summary.consistencyRate).toBeCloseTo(33.33, 1);
  });
});

describe('formatDiff', () => {
  it('should format a diff with added and removed issues', () => {
    const diff = {
      added: [{
        type: 'test-issue',
        message: 'New issue',
        severity: IssueSeverity.ERROR,
        category: IssueCategory.JAVASCRIPT,
        url: 'https://example.com',
        timestamp: Date.now(),
      }],
      removed: [{
        type: 'test-issue',
        message: 'Fixed issue',
        severity: IssueSeverity.WARNING,
        category: IssueCategory.NETWORK,
        url: 'https://example.com',
        timestamp: Date.now(),
      }],
      unchanged: [],
      summary: {
        totalAdded: 1,
        totalRemoved: 1,
        totalUnchanged: 0,
        matchPercentage: 0,
      },
    };

    const formatted = formatDiff(diff);

    expect(formatted).toContain('=== Scan Comparison ===');
    expect(formatted).toContain('Match Rate: 0.0%');
    expect(formatted).toContain('Added: 1');
    expect(formatted).toContain('Removed: 1');
    expect(formatted).toContain('➕ Added Issues:');
    expect(formatted).toContain('New issue');
    expect(formatted).toContain('➖ Removed Issues:');
    expect(formatted).toContain('Fixed issue');
  });

  it('should show success message when issues are unchanged', () => {
    const diff = {
      added: [],
      removed: [],
      unchanged: [{
        type: 'test-issue',
        message: 'Consistent issue',
        severity: IssueSeverity.ERROR,
        category: IssueCategory.JAVASCRIPT,
        url: 'https://example.com',
        timestamp: Date.now(),
      }],
      summary: {
        totalAdded: 0,
        totalRemoved: 0,
        totalUnchanged: 1,
        matchPercentage: 100,
      },
    };

    const formatted = formatDiff(diff);

    expect(formatted).toContain('Match Rate: 100.0%');
    expect(formatted).toContain('✅ 1 issues reproduced successfully');
  });
});
