import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generateHtmlReport } from '../../src/reporters/html-reporter.js';
import type { ScanResults, PageScanResult } from '../../src/scanner/index.js';
import { readFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('HTML Reporter', () => {
  let tempFile: string;

  beforeEach(() => {
    tempFile = join(tmpdir(), `test-report-${Date.now()}.html`);
  });

  afterEach(() => {
    if (existsSync(tempFile)) {
      unlinkSync(tempFile);
    }
  });

  it('should generate valid HTML file', () => {
    const mockResults: ScanResults = {
      timestamp: '2024-01-01T00:00:00.000Z',
      url: 'https://example.com',
      config: {} as any,
      pages: [],
      summary: {
        pagesScanned: 1,
        totalIssues: 0,
        duration: '1.5s',
        byCategory: {},
        bySeverity: {},
      },
    };

    generateHtmlReport(mockResults, tempFile);

    expect(existsSync(tempFile)).toBe(true);
    const html = readFileSync(tempFile, 'utf8');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('Scan Report');
  });

  it('should display summary statistics correctly', () => {
    const mockResults: ScanResults = {
      timestamp: '2024-01-01T00:00:00.000Z',
      url: 'https://example.com',
      config: {} as any,
      pages: [],
      summary: {
        pagesScanned: 5,
        totalIssues: 10,
        duration: '5.2s',
        byCategory: { accessibility: 5, performance: 5 },
        bySeverity: { error: 3, warning: 7, info: 0 },
      },
    };

    generateHtmlReport(mockResults, tempFile);

    const html = readFileSync(tempFile, 'utf8');
    expect(html).toContain('5</div>'); // pagesScanned
    expect(html).toContain('10</div>'); // totalIssues
    expect(html).toContain('3</div>'); // errors
    expect(html).toContain('7</div>'); // warnings
    expect(html).toContain('5.2s</div>'); // duration
  });

  it('should show "no issues" message when scan is clean', () => {
    const mockResults: ScanResults = {
      timestamp: '2024-01-01T00:00:00.000Z',
      url: 'https://example.com',
      config: {} as any,
      pages: [],
      summary: {
        pagesScanned: 3,
        totalIssues: 0,
        duration: '2.1s',
        byCategory: {},
        bySeverity: {},
      },
    };

    generateHtmlReport(mockResults, tempFile);

    const html = readFileSync(tempFile, 'utf8');
    expect(html).toContain('No Issues Found');
    expect(html).toContain('All analyzed pages passed without any detected issues');
  });

  it('should display issues by category', () => {
    const mockPage: PageScanResult = {
      url: 'https://example.com',
      depth: 0,
      crawledAt: 0,
      detectorResults: [
        {
          detectorId: 'accessibility',
          detectorName: 'Accessibility',
          issues: [
            {
              severity: 'error',
              category: 'accessibility',
              message: 'Missing alt text on image',
              details: { element: 'img.logo' },
            },
          ],
        },
      ],
      summary: {
        totalIssues: 1,
        byCategory: { accessibility: 1 },
        bySeverity: { error: 1 },
      },
    };

    const mockResults: ScanResults = {
      timestamp: '2024-01-01T00:00:00.000Z',
      url: 'https://example.com',
      config: {} as any,
      pages: [mockPage],
      summary: {
        pagesScanned: 1,
        totalIssues: 1,
        duration: '1.0s',
        byCategory: { accessibility: 1 },
        bySeverity: { error: 1 },
      },
    };

    generateHtmlReport(mockResults, tempFile);

    const html = readFileSync(tempFile, 'utf8');
    expect(html).toContain('Missing alt text on image');
    expect(html).toContain('accessibility');
    expect(html).toContain('error');
  });

  it('should escape HTML in user content', () => {
    const mockPage: PageScanResult = {
      url: 'https://example.com',
      depth: 0,
      crawledAt: 0,
      detectorResults: [
        {
          detectorId: 'test',
          detectorName: 'Test',
          issues: [
            {
              severity: 'warning',
              category: 'test',
              message: '<script>alert("XSS")</script>',
              details: {},
            },
          ],
        },
      ],
      summary: {
        totalIssues: 1,
        byCategory: { test: 1 },
        bySeverity: { warning: 1 },
      },
    };

    const mockResults: ScanResults = {
      timestamp: '2024-01-01T00:00:00.000Z',
      url: 'https://example.com',
      config: {} as any,
      pages: [mockPage],
      summary: {
        pagesScanned: 1,
        totalIssues: 1,
        duration: '1.0s',
        byCategory: { test: 1 },
        bySeverity: { warning: 1 },
      },
    };

    generateHtmlReport(mockResults, tempFile);

    const html = readFileSync(tempFile, 'utf8');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>alert');
  });

  it('should display page summary with issue counts', () => {
    const mockPages: PageScanResult[] = [
      {
        url: 'https://example.com',
        depth: 0,
        crawledAt: 0,
        detectorResults: [],
        summary: {
          totalIssues: 0,
          byCategory: {},
          bySeverity: {},
        },
      },
      {
        url: 'https://example.com/page2',
        depth: 1,
        crawledAt: 0,
        detectorResults: [
          {
            detectorId: 'test',
            detectorName: 'Test',
            issues: [
              {
                severity: 'error',
                category: 'test',
                message: 'Test issue',
                details: {},
              },
            ],
          },
        ],
        summary: {
          totalIssues: 1,
          byCategory: { test: 1 },
          bySeverity: { error: 1 },
        },
      },
    ];

    const mockResults: ScanResults = {
      timestamp: '2024-01-01T00:00:00.000Z',
      url: 'https://example.com',
      config: {} as any,
      pages: mockPages,
      summary: {
        pagesScanned: 2,
        totalIssues: 1,
        duration: '2.0s',
        byCategory: { test: 1 },
        bySeverity: { error: 1 },
      },
    };

    generateHtmlReport(mockResults, tempFile);

    const html = readFileSync(tempFile, 'utf8');
    expect(html).toContain('https://example.com');
    expect(html).toContain('https://example.com/page2');
    expect(html).toContain('Pages');
    expect(html).toContain('Depth 1');
  });

  it('should include CSS styles for visual presentation', () => {
    const mockResults: ScanResults = {
      timestamp: '2024-01-01T00:00:00.000Z',
      url: 'https://example.com',
      config: {} as any,
      pages: [],
      summary: {
        pagesScanned: 1,
        totalIssues: 0,
        duration: '1.0s',
        byCategory: {},
        bySeverity: {},
      },
    };

    generateHtmlReport(mockResults, tempFile);

    const html = readFileSync(tempFile, 'utf8');
    expect(html).toContain('<style>');
    expect(html).toContain('font-family');
    expect(html).toContain('background');
    expect(html).toContain('--gray-');
  });

  it('should display bar chart for issue categories', () => {
    const mockPage: PageScanResult = {
      url: 'https://example.com',
      depth: 0,
      crawledAt: 0,
      detectorResults: [
        {
          detectorId: 'test',
          detectorName: 'Test',
          issues: [
            {
              severity: 'error',
              category: 'accessibility',
              message: 'Issue 1',
              details: {},
            },
            {
              severity: 'warning',
              category: 'performance',
              message: 'Issue 2',
              details: {},
            },
          ],
        },
      ],
      summary: {
        totalIssues: 2,
        byCategory: { accessibility: 1, performance: 1 },
        bySeverity: { error: 1, warning: 1 },
      },
    };

    const mockResults: ScanResults = {
      timestamp: '2024-01-01T00:00:00.000Z',
      url: 'https://example.com',
      config: {} as any,
      pages: [mockPage],
      summary: {
        pagesScanned: 1,
        totalIssues: 2,
        duration: '1.0s',
        byCategory: { accessibility: 1, performance: 1 },
        bySeverity: { error: 1, warning: 1 },
      },
    };

    generateHtmlReport(mockResults, tempFile);

    const html = readFileSync(tempFile, 'utf8');
    expect(html).toContain('distribution-grid');
    expect(html).toContain('distribution-value');
    expect(html).toContain('distribution-label');
  });
});
