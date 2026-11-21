import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser } from '@playwright/test';
import { WebVitalsDetector } from '../../src/detectors/web-vitals.js';

// Regression: the detector used to inject web-vitals with a <script type="module">
// that imported from unpkg.com. Any page with a strict Content-Security-Policy blocked
// it, so the scan logged a CSP violation per page and collected no metrics.
describe('WebVitalsDetector on a page with a strict CSP', () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    await browser.close();
  });

  it('collects metrics without triggering a CSP violation', async () => {
    const page = await browser.newPage();
    const violations: string[] = [];
    page.on('console', (msg) => {
      if (msg.text().includes('Content Security Policy')) violations.push(msg.text());
    });

    await page.route('https://csp.test/', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        headers: { 'content-security-policy': "default-src 'self'; script-src 'self'" },
        body: '<!doctype html><html><head><title>csp</title></head><body><h1>Hello</h1><p>Strict CSP page.</p></body></html>',
      })
    );
    await page.goto('https://csp.test/');

    const detector = new WebVitalsDetector();
    await detector.scan(page);

    const names = detector.getMetrics().map((m) => m.name);
    expect(names).toContain('TTFB');
    expect(names).toContain('FCP');
    expect(violations).toEqual([]);

    await page.close();
  }, 30000);
});
