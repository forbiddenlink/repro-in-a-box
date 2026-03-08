import type { Page, Response } from '@playwright/test';
import { BaseDetector, IssueCategory, IssueSeverity, type DetectorConfig, type Issue } from './base.js';

/** Cookie information for security checks */
interface CookieInfo {
  name: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: string;
}

/** Resource information for SRI checks */
interface ResourceInfo {
  type: 'script' | 'stylesheet';
  src: string;
  hasIntegrity: boolean;
  isExternal: boolean;
}

/**
 * Detector for security issues including HTTPS, security headers, cookies, and SRI
 */
export class SecurityDetector extends BaseDetector {
  readonly id = 'security';
  readonly name = 'Security';
  readonly description = 'Detects security issues: HTTPS enforcement, security headers, cookie flags, SRI validation';
  readonly category = IssueCategory.SECURITY;

  private responseHeaders: Record<string, string> = {};
  private cookies: CookieInfo[] = [];

  setup(_config?: DetectorConfig): Promise<void> {
    this.responseHeaders = {};
    this.cookies = [];
    return super.setup(_config);
  }

  async attach(page: Page, _config?: DetectorConfig): Promise<void> {
    // Capture response headers from the main document
    page.on('response', (response: Response) => {
      const request = response.request();
      // Only capture headers from document requests (the main page)
      if (request.resourceType() === 'document') {
        const headers = response.headers();
        // Store headers in lowercase for consistent lookup
        for (const [key, value] of Object.entries(headers)) {
          this.responseHeaders[key.toLowerCase()] = value;
        }
      }
    });
  }

  async scan(page: Page, _config?: DetectorConfig): Promise<Issue[]> {
    const url = page.url();

    // Check HTTPS enforcement
    this.checkHttps(url);

    // Check security headers
    this.checkSecurityHeaders(this.responseHeaders, url);

    // Check cookie security
    const cookies = await page.context().cookies();
    this.cookies = cookies.map(c => ({
      name: c.name,
      secure: c.secure,
      httpOnly: c.httpOnly,
      sameSite: c.sameSite || '',
    }));
    this.checkCookieSecurity(this.cookies, url);

    // Check SRI for external resources
    const resources = await this.extractExternalResources(page);
    this.checkSri(resources, url);

    return this.issues;
  }

  /**
   * Check if page is served over HTTPS
   */
  private checkHttps(url: string): void {
    if (url.startsWith('http://') && !url.includes('localhost') && !url.includes('127.0.0.1')) {
      this.addIssue(this.createIssue(
        'security-no-https',
        'Page is not served over HTTPS',
        IssueSeverity.CRITICAL,
        url,
        { details: JSON.stringify({ recommendation: 'Enable HTTPS and redirect all HTTP traffic to HTTPS' }, null, 2) }
      ));
    }
  }

  /**
   * Check for presence of security headers
   */
  private checkSecurityHeaders(headers: Record<string, string>, url: string): void {
    // Check X-Frame-Options
    if (!headers['x-frame-options']) {
      this.addIssue(this.createIssue(
        'security-missing-x-frame-options',
        'Missing X-Frame-Options header (clickjacking protection)',
        IssueSeverity.WARNING,
        url,
        { details: JSON.stringify({ recommendation: 'Add X-Frame-Options: DENY or SAMEORIGIN' }, null, 2) }
      ));
    }

    // Check X-Content-Type-Options
    if (!headers['x-content-type-options']) {
      this.addIssue(this.createIssue(
        'security-missing-x-content-type-options',
        'Missing X-Content-Type-Options header (MIME sniffing protection)',
        IssueSeverity.WARNING,
        url,
        { details: JSON.stringify({ recommendation: 'Add X-Content-Type-Options: nosniff' }, null, 2) }
      ));
    }

    // Check Content-Security-Policy
    if (!headers['content-security-policy'] && !headers['content-security-policy-report-only']) {
      this.addIssue(this.createIssue(
        'security-missing-csp',
        'Missing Content-Security-Policy header',
        IssueSeverity.INFO,
        url,
        { details: JSON.stringify({ recommendation: "Add Content-Security-Policy header to control resource loading" }, null, 2) }
      ));
    }

    // Check Strict-Transport-Security (HSTS)
    if (!headers['strict-transport-security'] && url.startsWith('https://')) {
      this.addIssue(this.createIssue(
        'security-missing-hsts',
        'Missing Strict-Transport-Security header (HSTS)',
        IssueSeverity.WARNING,
        url,
        { details: JSON.stringify({ recommendation: 'Add Strict-Transport-Security: max-age=31536000; includeSubDomains' }, null, 2) }
      ));
    }

    // Check Referrer-Policy
    if (!headers['referrer-policy']) {
      this.addIssue(this.createIssue(
        'security-missing-referrer-policy',
        'Missing Referrer-Policy header',
        IssueSeverity.INFO,
        url,
        { details: JSON.stringify({ recommendation: 'Add Referrer-Policy: strict-origin-when-cross-origin' }, null, 2) }
      ));
    }

    // Check Permissions-Policy (Feature-Policy successor)
    if (!headers['permissions-policy'] && !headers['feature-policy']) {
      this.addIssue(this.createIssue(
        'security-missing-permissions-policy',
        'Missing Permissions-Policy header',
        IssueSeverity.INFO,
        url,
        { details: JSON.stringify({ recommendation: 'Add Permissions-Policy to control browser features' }, null, 2) }
      ));
    }
  }

  /**
   * Check cookie security flags
   */
  private checkCookieSecurity(cookies: CookieInfo[], url: string): void {
    for (const cookie of cookies) {
      // Check Secure flag
      if (!cookie.secure && url.startsWith('https://')) {
        this.addIssue(this.createIssue(
          'security-cookie-no-secure',
          `Cookie "${cookie.name}" missing Secure flag`,
          IssueSeverity.WARNING,
          url,
          { details: JSON.stringify({ cookie: cookie.name, recommendation: 'Add Secure flag to prevent transmission over HTTP' }, null, 2) }
        ));
      }

      // Check HttpOnly flag (for sensitive cookies)
      if (!cookie.httpOnly && this.isSensitiveCookie(cookie.name)) {
        this.addIssue(this.createIssue(
          'security-cookie-no-httponly',
          `Cookie "${cookie.name}" missing HttpOnly flag`,
          IssueSeverity.WARNING,
          url,
          { details: JSON.stringify({ cookie: cookie.name, recommendation: 'Add HttpOnly flag to prevent JavaScript access' }, null, 2) }
        ));
      }

      // Check SameSite attribute
      if (!cookie.sameSite || cookie.sameSite === 'None') {
        // SameSite=None is only an issue if Secure is also missing
        if (cookie.sameSite === 'None' && !cookie.secure) {
          this.addIssue(this.createIssue(
            'security-cookie-no-samesite',
            `Cookie "${cookie.name}" has SameSite=None without Secure flag`,
            IssueSeverity.WARNING,
            url,
            { details: JSON.stringify({ cookie: cookie.name, recommendation: 'Use SameSite=Strict or SameSite=Lax, or add Secure flag with SameSite=None' }, null, 2) }
          ));
        } else if (!cookie.sameSite) {
          this.addIssue(this.createIssue(
            'security-cookie-no-samesite',
            `Cookie "${cookie.name}" missing SameSite attribute`,
            IssueSeverity.INFO,
            url,
            { details: JSON.stringify({ cookie: cookie.name, recommendation: 'Add SameSite=Strict or SameSite=Lax to prevent CSRF' }, null, 2) }
          ));
        }
      }
    }
  }

  /**
   * Check if cookie name suggests it's sensitive
   */
  private isSensitiveCookie(name: string): boolean {
    const sensitivePatterns = [
      /session/i,
      /auth/i,
      /token/i,
      /csrf/i,
      /jwt/i,
      /user/i,
      /login/i,
    ];
    return sensitivePatterns.some(pattern => pattern.test(name));
  }

  /**
   * Extract external script and stylesheet resources
   */
  private async extractExternalResources(page: Page): Promise<ResourceInfo[]> {
    const resources: ResourceInfo[] = [];

    // Get scripts
    const scripts = await page.$$eval('script[src]', (elements: HTMLScriptElement[]) =>
      elements.map(el => ({
        src: el.src,
        hasIntegrity: !!el.integrity,
      }))
    );

    // Get stylesheets
    const stylesheets = await page.$$eval('link[rel="stylesheet"][href]', (elements: HTMLLinkElement[]) =>
      elements.map(el => ({
        src: el.href,
        hasIntegrity: !!el.integrity,
      }))
    );

    const pageUrl = page.url();
    const pageOrigin = new URL(pageUrl).origin;

    for (const script of scripts) {
      try {
        const srcOrigin = new URL(script.src).origin;
        resources.push({
          type: 'script',
          src: script.src,
          hasIntegrity: script.hasIntegrity,
          isExternal: srcOrigin !== pageOrigin,
        });
      } catch {
        // Invalid URL, skip
      }
    }

    for (const stylesheet of stylesheets) {
      try {
        const srcOrigin = new URL(stylesheet.src).origin;
        resources.push({
          type: 'stylesheet',
          src: stylesheet.src,
          hasIntegrity: stylesheet.hasIntegrity,
          isExternal: srcOrigin !== pageOrigin,
        });
      } catch {
        // Invalid URL, skip
      }
    }

    return resources;
  }

  /**
   * Check Subresource Integrity for external resources
   */
  private checkSri(resources: ResourceInfo[], url: string): void {
    for (const resource of resources) {
      if (resource.isExternal && !resource.hasIntegrity) {
        this.addIssue(this.createIssue(
          'security-missing-sri',
          `External ${resource.type} missing integrity attribute: ${this.truncateUrl(resource.src)}`,
          IssueSeverity.INFO,
          url,
          { details: JSON.stringify({ resource: resource.src, type: resource.type, recommendation: 'Add integrity attribute with SHA-384 or SHA-512 hash' }, null, 2) }
        ));
      }
    }
  }

  /**
   * Truncate long URLs for display
   */
  private truncateUrl(url: string): string {
    if (url.length > 60) {
      return url.slice(0, 30) + '...' + url.slice(-27);
    }
    return url;
  }

  cleanup(): Promise<void> {
    this.responseHeaders = {};
    this.cookies = [];
    return super.cleanup();
  }
}
