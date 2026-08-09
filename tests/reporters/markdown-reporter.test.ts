import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generateMarkdownReport } from '../../src/reporters/markdown-reporter.js';
import type { ScanResults, PageScanResult } from '../../src/scanner/index.js';
import { readFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Markdown Reporter', () => {
  let tempFile: string;

  beforeEach(() => {
    tempFile = join(tmpdir(), `test-report-${Date.now()}.md`);
  });

  afterEach(() => {
    if (existsSync(tempFile)) {
      unlinkSync(tempFile);
    }
  });

  it('should generate a clean report with no issues', () => {
    const mockResults: ScanResults = {
      timestamp: '2024-01-01T00:00:00.000Z',
      url: 'https://example.com',
      config: {} as any,
      pages: [],
      summary: {
        pagesScanned: 2,
        totalIssues: 0,
        duration: '1.2s',
        byCategory: {},
        bySeverity: {},
      },
    };

    const md = generateMarkdownReport(mockResults, tempFile);
    expect(existsSync(tempFile)).toBe(true);
    expect(md).toContain('✅ Clean');
    expect(md).toContain('https://example.com');
    expect(md).toContain('| Total issues | 0 |');
    expect(readFileSync(tempFile, 'utf8')).toContain('Repro-in-a-Box');
  });

  it('should include issue rows and category summary', () => {
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
              message: 'Missing alt text',
              details: {},
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

    const md = generateMarkdownReport(mockResults);
    expect(md).toContain('❌ Issues found');
    expect(md).toContain('Missing alt text');
    expect(md).toContain('**accessibility**: 1');
    expect(md).toContain('| error | accessibility |');
  });

  it('should escape pipe characters in cells', () => {
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
              message: 'foo | bar',
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

    const md = generateMarkdownReport(mockResults);
    expect(md).toContain('foo \\| bar');
  });
});
