import type { ScanResults } from '../scanner/index.js';
import { writeFileSync } from 'fs';

/**
 * Generate a professional, modern HTML report
 */
export function generateHtmlReport(results: ScanResults, outputPath: string): void {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Scan Report - ${results.url}</title>
  <style>
    :root {
      --gray-50: #fafafa;
      --gray-100: #f5f5f5;
      --gray-200: #e5e5e5;
      --gray-300: #d4d4d4;
      --gray-400: #a3a3a3;
      --gray-500: #737373;
      --gray-600: #525252;
      --gray-700: #404040;
      --gray-800: #262626;
      --gray-900: #171717;
      
      --red-50: #fef2f2;
      --red-500: #ef4444;
      --red-600: #dc2626;
      --red-900: #7f1d1d;
      
      --amber-50: #fffbeb;
      --amber-500: #f59e0b;
      --amber-600: #d97706;
      --amber-900: #78350f;
      
      --blue-50: #eff6ff;
      --blue-500: #3b82f6;
      --blue-600: #2563eb;
      
      --green-50: #f0fdf4;
      --green-500: #22c55e;
      --green-600: #16a34a;
      
      --spacing-1: 4px;
      --spacing-2: 8px;
      --spacing-3: 12px;
      --spacing-4: 16px;
      --spacing-6: 24px;
      --spacing-8: 32px;
      --spacing-12: 48px;
      --spacing-16: 64px;
      
      --radius-sm: 4px;
      --radius-md: 6px;
      --radius-lg: 8px;
      --radius-xl: 12px;
      
      --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
      --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
      --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.03);
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: var(--gray-900);
      background: var(--gray-50);
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    
    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: var(--spacing-8);
    }
    
    header {
      margin-bottom: var(--spacing-8);
      padding-bottom: var(--spacing-8);
      border-bottom: 1px solid var(--gray-200);
    }
    
    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: var(--spacing-6);
      flex-wrap: wrap;
    }
    
    .header-info h1 {
      font-size: 24px;
      font-weight: 600;
      color: var(--gray-900);
      margin-bottom: var(--spacing-2);
      letter-spacing: -0.02em;
    }
    
    .url {
      font-size: 13px;
      color: var(--gray-600);
      font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
      word-break: break-all;
      margin-bottom: var(--spacing-1);
    }
    
    .timestamp {
      font-size: 13px;
      color: var(--gray-500);
    }
    
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: var(--spacing-4);
      margin-bottom: var(--spacing-8);
    }
    
    .metric-card {
      background: white;
      border: 1px solid var(--gray-200);
      border-radius: var(--radius-lg);
      padding: var(--spacing-4);
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }
    
    .metric-card:hover {
      border-color: var(--gray-300);
      box-shadow: var(--shadow-sm);
    }
    
    .metric-label {
      font-size: 12px;
      font-weight: 500;
      color: var(--gray-600);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: var(--spacing-2);
    }
    
    .metric-value {
      font-size: 28px;
      font-weight: 600;
      color: var(--gray-900);
      line-height: 1;
      letter-spacing: -0.02em;
    }
    
    .metric-card.error .metric-value { color: var(--red-600); }
    .metric-card.warning .metric-value { color: var(--amber-600); }
    .metric-card.info .metric-value { color: var(--blue-600); }
    .metric-card.success .metric-value { color: var(--green-600); }
    
    .section {
      background: white;
      border: 1px solid var(--gray-200);
      border-radius: var(--radius-xl);
      padding: var(--spacing-6);
      margin-bottom: var(--spacing-6);
    }
    
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--spacing-6);
      padding-bottom: var(--spacing-4);
      border-bottom: 1px solid var(--gray-100);
    }
    
    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--gray-900);
      letter-spacing: -0.01em;
    }
    
    .section-count {
      font-size: 13px;
      color: var(--gray-500);
      font-weight: 500;
    }
    
    .issue-table {
      width: 100%;
      border-collapse: collapse;
    }
    
    .issue-table thead {
      border-bottom: 1px solid var(--gray-200);
    }
    
    .issue-table th {
      text-align: left;
      padding: var(--spacing-3) var(--spacing-4);
      font-size: 12px;
      font-weight: 600;
      color: var(--gray-700);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    .issue-table tbody tr {
      border-bottom: 1px solid var(--gray-100);
      transition: background-color 0.15s ease;
    }
    
    .issue-table tbody tr:last-child {
      border-bottom: none;
    }
    
    .issue-table tbody tr:hover {
      background: var(--gray-50);
    }
    
    .issue-table td {
      padding: var(--spacing-4);
      font-size: 13px;
      vertical-align: top;
    }
    
    .severity-badge {
      display: inline-flex;
      align-items: center;
      padding: var(--spacing-1) var(--spacing-3);
      border-radius: var(--radius-sm);
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    .severity-badge.error {
      background: var(--red-50);
      color: var(--red-900);
    }
    
    .severity-badge.warning {
      background: var(--amber-50);
      color: var(--amber-900);
    }
    
    .severity-badge.info {
      background: var(--blue-50);
      color: var(--blue-600);
    }
    
    .category-cell {
      font-size: 12px;
      color: var(--gray-600);
      font-weight: 500;
    }
    
    .message-cell {
      color: var(--gray-900);
      max-width: 600px;
    }
    
    .url-cell {
      font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
      font-size: 12px;
      color: var(--gray-500);
      max-width: 400px;
      word-break: break-all;
    }
    
    .details-toggle {
      color: var(--blue-600);
      font-size: 12px;
      cursor: pointer;
      user-select: none;
      font-weight: 500;
      margin-top: var(--spacing-2);
    }
    
    .details-toggle:hover {
      color: var(--blue-500);
    }
    
    .issue-details {
      margin-top: var(--spacing-3);
      padding: var(--spacing-3);
      background: var(--gray-50);
      border-radius: var(--radius-md);
      font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
      font-size: 11px;
      color: var(--gray-700);
      white-space: pre-wrap;
      word-break: break-word;
      display: none;
    }
    
    .issue-details.visible {
      display: block;
    }
    
    .distribution-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: var(--spacing-4);
      margin-top: var(--spacing-6);
    }
    
    .distribution-item {
      display: flex;
      align-items: center;
      gap: var(--spacing-3);
      padding: var(--spacing-3);
      background: var(--gray-50);
      border-radius: var(--radius-md);
    }
    
    .distribution-bar {
      flex: 1;
      height: 6px;
      background: var(--gray-200);
      border-radius: 3px;
      overflow: hidden;
    }
    
    .distribution-fill {
      height: 100%;
      background: var(--gray-700);
      border-radius: 3px;
      transition: width 0.3s ease;
    }
    
    .distribution-label {
      font-size: 12px;
      color: var(--gray-700);
      font-weight: 500;
      min-width: 100px;
    }
    
    .distribution-value {
      font-size: 12px;
      color: var(--gray-600);
      font-weight: 600;
      min-width: 30px;
      text-align: right;
    }
    
    .pages-list {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-3);
    }
    
    .page-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--spacing-4);
      background: var(--gray-50);
      border-radius: var(--radius-md);
      transition: background-color 0.15s ease;
    }
    
    .page-item:hover {
      background: var(--gray-100);
    }
    
    .page-url {
      font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
      font-size: 12px;
      color: var(--gray-700);
      word-break: break-all;
    }
    
    .page-meta {
      display: flex;
      gap: var(--spacing-4);
      align-items: center;
      flex-shrink: 0;
    }
    
    .page-depth {
      font-size: 11px;
      color: var(--gray-500);
      font-weight: 500;
    }
    
    .page-issues {
      font-size: 12px;
      font-weight: 600;
      padding: var(--spacing-1) var(--spacing-2);
      border-radius: var(--radius-sm);
    }
    
    .page-issues.clean {
      color: var(--green-600);
    }
    
    .page-issues.has-issues {
      color: var(--red-600);
      background: var(--red-50);
    }
    
    .empty-state {
      text-align: center;
      padding: var(--spacing-16) var(--spacing-8);
    }
    
    .empty-state-icon {
      width: 64px;
      height: 64px;
      margin: 0 auto var(--spacing-4);
      border-radius: 50%;
      background: var(--green-50);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .empty-state-icon svg {
      width: 32px;
      height: 32px;
      color: var(--green-600);
    }
    
    .empty-state-title {
      font-size: 18px;
      font-weight: 600;
      color: var(--gray-900);
      margin-bottom: var(--spacing-2);
    }
    
    .empty-state-message {
      font-size: 14px;
      color: var(--gray-600);
    }
    
    footer {
      margin-top: var(--spacing-8);
      padding-top: var(--spacing-6);
      border-top: 1px solid var(--gray-200);
      text-align: center;
    }
    
    .footer-text {
      font-size: 12px;
      color: var(--gray-500);
    }
    
    .footer-brand {
      font-weight: 600;
      color: var(--gray-700);
    }
    
    @media (max-width: 768px) {
      .container {
        padding: var(--spacing-4);
      }
      
      .metrics-grid {
        grid-template-columns: 1fr;
      }
      
      .issue-table {
        display: block;
        overflow-x: auto;
      }
      
      .header-content {
        flex-direction: column;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="header-content">
        <div class="header-info">
          <h1>Scan Report</h1>
          <div class="url">${escapeHtml(results.url)}</div>
          <div class="timestamp">Scanned ${new Date(results.timestamp).toLocaleString('en-US', { 
            dateStyle: 'medium', 
            timeStyle: 'short' 
          })}</div>
        </div>
      </div>
    </header>
    
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">Pages Scanned</div>
        <div class="metric-value">${results.summary.pagesScanned}</div>
      </div>
      <div class="metric-card ${results.summary.totalIssues === 0 ? 'success' : results.summary.totalIssues < 10 ? 'warning' : 'error'}">
        <div class="metric-label">Total Issues</div>
        <div class="metric-value">${results.summary.totalIssues}</div>
      </div>
      <div class="metric-card error">
        <div class="metric-label">Errors</div>
        <div class="metric-value">${results.summary.bySeverity.error || 0}</div>
      </div>
      <div class="metric-card warning">
        <div class="metric-label">Warnings</div>
        <div class="metric-value">${results.summary.bySeverity.warning || 0}</div>
      </div>
      <div class="metric-card info">
        <div class="metric-label">Info</div>
        <div class="metric-value">${results.summary.bySeverity.info || 0}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Duration</div>
        <div class="metric-value" style="font-size: 20px;">${results.summary.duration}</div>
      </div>
    </div>
    
    ${generateIssuesByCategory(results)}
    ${generateDistributionCharts(results)}
    ${generatePageSummary(results)}
    
    <footer>
      <div class="footer-text">
        Generated by <span class="footer-brand">Repro-in-a-Box</span>
      </div>
    </footer>
  </div>
</body>
</html>`;

  writeFileSync(outputPath, html, 'utf8');
}

function generateIssuesByCategory(results: ScanResults): string {
  if (results.summary.totalIssues === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
        </div>
        <div class="empty-state-title">No Issues Found</div>
        <div class="empty-state-message">All analyzed pages passed without any detected issues.</div>
      </div>
    `;
  }

  interface IssueWithPage {
    category: string;
    severity: string;
    message: string;
    details?: unknown;
    pageUrl: string;
  }

  const issuesByCategory: Record<string, IssueWithPage[]> = {};

  for (const page of results.pages) {
    for (const detectorResult of page.detectorResults) {
      for (const issue of detectorResult.issues) {
        if (!issuesByCategory[issue.category]) {
          issuesByCategory[issue.category] = [];
        }
        issuesByCategory[issue.category].push({ ...issue, pageUrl: page.url });
      }
    }
  }

  let html = '<div class="section">';
  html += '<div class="section-header">';
  html += '<div class="section-title">Issues</div>';
  html += `<div class="section-count">${results.summary.totalIssues} total</div>`;
  html += '</div>';

  html += '<table class="issue-table">';
  html += '<thead><tr>';
  html += '<th width="100">Severity</th>';
  html += '<th width="150">Category</th>';
  html += '<th>Message</th>';
  html += '<th width="300">URL</th>';
  html += '</tr></thead>';
  html += '<tbody>';

  let issueId = 0;
  for (const [category, issues] of Object.entries(issuesByCategory)) {
    for (const issue of issues.slice(0, 50)) { // Show first 50 issues
      const id = `issue-${issueId++}`;
      html += '<tr>';
      html += `<td><span class="severity-badge ${issue.severity}">${issue.severity}</span></td>`;
      html += `<td class="category-cell">${escapeHtml(category)}</td>`;
      html += `<td class="message-cell">
        ${escapeHtml(issue.message)}
        ${issue.details ? `<div class="details-toggle" onclick="document.getElementById('${id}').classList.toggle('visible')">View details</div>
        <div id="${id}" class="issue-details">${escapeHtml(JSON.stringify(issue.details, null, 2))}</div>` : ''}
      </td>`;
      html += `<td class="url-cell">${escapeHtml(issue.pageUrl)}</td>`;
      html += '</tr>';
    }
  }

  html += '</tbody></table>';
  
  const remainingIssues = results.summary.totalIssues - 50;
  if (remainingIssues > 0) {
    html += `<div style="text-align: center; padding: var(--spacing-4); color: var(--gray-500); font-size: 13px;">`;
    html += `${remainingIssues} more issue${remainingIssues !== 1 ? 's' : ''} not shown`;
    html += '</div>';
  }
  
  html += '</div>';

  return html;
}

function generateDistributionCharts(results: ScanResults): string {
  if (results.summary.totalIssues === 0) {
    return '';
  }

  let html = '<div class="section">';
  html += '<div class="section-header">';
  html += '<div class="section-title">Distribution</div>';
  html += '</div>';

  // Category distribution
  html += '<div class="distribution-grid">';
  for (const [category, count] of Object.entries(results.summary.byCategory)) {
    const percentage = (count / results.summary.totalIssues) * 100;
    html += '<div class="distribution-item">';
    html += `<div class="distribution-label">${escapeHtml(category)}</div>`;
    html += '<div class="distribution-bar">';
    html += `<div class="distribution-fill" style="width: ${percentage}%"></div>`;
    html += '</div>';
    html += `<div class="distribution-value">${count}</div>`;
    html += '</div>';
  }
  html += '</div>';

  html += '</div>';
  return html;
}

function generatePageSummary(results: ScanResults): string {
  let html = '<div class="section">';
  html += '<div class="section-header">';
  html += '<div class="section-title">Pages</div>';
  html += `<div class="section-count">${results.summary.pagesScanned} scanned</div>`;
  html += '</div>';
  
  html += '<div class="pages-list">';
  
  for (const page of results.pages) {
    const issueCount = page.summary.totalIssues;
    
    html += '<div class="page-item">';
    html += `<div class="page-url">${escapeHtml(page.url)}</div>`;
    html += '<div class="page-meta">';
    html += `<div class="page-depth">Depth ${page.depth}</div>`;
    html += `<div class="page-issues ${issueCount === 0 ? 'clean' : 'has-issues'}">`;
    html += issueCount === 0 ? 'Clean' : `${issueCount} issue${issueCount !== 1 ? 's' : ''}`;
    html += '</div>';
    html += '</div>';
    html += '</div>';
  }
  
  html += '</div></div>';
  return html;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}
