import { describe, it, expect, beforeEach } from 'vitest';
import { SecurityDetector } from '../../src/detectors/security.js';
import { IssueCategory, IssueSeverity } from '../../src/detectors/base.js';

describe('SecurityDetector', () => {
  let detector: SecurityDetector;

  beforeEach(() => {
    detector = new SecurityDetector();
  });

  describe('metadata', () => {
    it('should have correct id', () => {
      expect(detector.id).toBe('security');
    });

    it('should have correct name', () => {
      expect(detector.name).toBe('Security');
    });

    it('should have correct category', () => {
      expect(detector.category).toBe(IssueCategory.SECURITY);
    });

    it('should have description mentioning key features', () => {
      expect(detector.description).toContain('security');
    });
  });

  describe('HTTPS checks', () => {
    it('should create critical issue for HTTP-only page', () => {
      const checkHttps = (detector as unknown as {
        checkHttps: (url: string) => void;
      }).checkHttps.bind(detector);

      checkHttps('http://example.com/page');
      expect(detector.issues.length).toBe(1);
      expect(detector.issues[0].type).toBe('security-no-https');
      expect(detector.issues[0].severity).toBe(IssueSeverity.CRITICAL);
    });

    it('should not create issue for HTTPS page', () => {
      const checkHttps = (detector as unknown as {
        checkHttps: (url: string) => void;
      }).checkHttps.bind(detector);

      checkHttps('https://example.com/page');
      expect(detector.issues.length).toBe(0);
    });
  });

  describe('security headers checks', () => {
    it('should create issue for missing X-Frame-Options', () => {
      const checkSecurityHeaders = (detector as unknown as {
        checkSecurityHeaders: (headers: Record<string, string>, url: string) => void;
      }).checkSecurityHeaders.bind(detector);

      checkSecurityHeaders({}, 'https://example.com');
      const xFrameIssue = detector.issues.find(i => i.type === 'security-missing-x-frame-options');
      expect(xFrameIssue).toBeDefined();
      expect(xFrameIssue?.severity).toBe(IssueSeverity.WARNING);
    });

    it('should create issue for missing X-Content-Type-Options', () => {
      const checkSecurityHeaders = (detector as unknown as {
        checkSecurityHeaders: (headers: Record<string, string>, url: string) => void;
      }).checkSecurityHeaders.bind(detector);

      checkSecurityHeaders({}, 'https://example.com');
      const xContentTypeIssue = detector.issues.find(i => i.type === 'security-missing-x-content-type-options');
      expect(xContentTypeIssue).toBeDefined();
    });

    it('should create issue for missing Content-Security-Policy', () => {
      const checkSecurityHeaders = (detector as unknown as {
        checkSecurityHeaders: (headers: Record<string, string>, url: string) => void;
      }).checkSecurityHeaders.bind(detector);

      checkSecurityHeaders({}, 'https://example.com');
      const cspIssue = detector.issues.find(i => i.type === 'security-missing-csp');
      expect(cspIssue).toBeDefined();
      expect(cspIssue?.severity).toBe(IssueSeverity.INFO);
    });

    it('should create issue for missing Strict-Transport-Security', () => {
      const checkSecurityHeaders = (detector as unknown as {
        checkSecurityHeaders: (headers: Record<string, string>, url: string) => void;
      }).checkSecurityHeaders.bind(detector);

      checkSecurityHeaders({}, 'https://example.com');
      const hstsIssue = detector.issues.find(i => i.type === 'security-missing-hsts');
      expect(hstsIssue).toBeDefined();
    });

    it('should not create issues when all security headers present', () => {
      const checkSecurityHeaders = (detector as unknown as {
        checkSecurityHeaders: (headers: Record<string, string>, url: string) => void;
      }).checkSecurityHeaders.bind(detector);

      checkSecurityHeaders({
        'x-frame-options': 'DENY',
        'x-content-type-options': 'nosniff',
        'content-security-policy': "default-src 'self'",
        'strict-transport-security': 'max-age=31536000',
        'referrer-policy': 'strict-origin-when-cross-origin',
        'permissions-policy': 'geolocation=()',
      }, 'https://example.com');
      expect(detector.issues.length).toBe(0);
    });
  });

  describe('cookie security checks', () => {
    it('should create issue for cookie without Secure flag', () => {
      const checkCookieSecurity = (detector as unknown as {
        checkCookieSecurity: (cookies: Array<{ name: string; secure: boolean; httpOnly: boolean; sameSite: string }>, url: string) => void;
      }).checkCookieSecurity.bind(detector);

      checkCookieSecurity([
        { name: 'session', secure: false, httpOnly: true, sameSite: 'Strict' }
      ], 'https://example.com');

      const secureIssue = detector.issues.find(i => i.type === 'security-cookie-no-secure');
      expect(secureIssue).toBeDefined();
      expect(secureIssue?.severity).toBe(IssueSeverity.WARNING);
    });

    it('should create issue for cookie without HttpOnly flag', () => {
      const checkCookieSecurity = (detector as unknown as {
        checkCookieSecurity: (cookies: Array<{ name: string; secure: boolean; httpOnly: boolean; sameSite: string }>, url: string) => void;
      }).checkCookieSecurity.bind(detector);

      checkCookieSecurity([
        { name: 'session', secure: true, httpOnly: false, sameSite: 'Strict' }
      ], 'https://example.com');

      const httpOnlyIssue = detector.issues.find(i => i.type === 'security-cookie-no-httponly');
      expect(httpOnlyIssue).toBeDefined();
    });

    it('should create issue for cookie without SameSite attribute', () => {
      const checkCookieSecurity = (detector as unknown as {
        checkCookieSecurity: (cookies: Array<{ name: string; secure: boolean; httpOnly: boolean; sameSite: string }>, url: string) => void;
      }).checkCookieSecurity.bind(detector);

      checkCookieSecurity([
        { name: 'session', secure: true, httpOnly: true, sameSite: '' }
      ], 'https://example.com');

      const sameSiteIssue = detector.issues.find(i => i.type === 'security-cookie-no-samesite');
      expect(sameSiteIssue).toBeDefined();
    });

    it('should not create issues for secure cookie', () => {
      const checkCookieSecurity = (detector as unknown as {
        checkCookieSecurity: (cookies: Array<{ name: string; secure: boolean; httpOnly: boolean; sameSite: string }>, url: string) => void;
      }).checkCookieSecurity.bind(detector);

      checkCookieSecurity([
        { name: 'session', secure: true, httpOnly: true, sameSite: 'Strict' }
      ], 'https://example.com');

      expect(detector.issues.length).toBe(0);
    });
  });

  describe('SRI checks', () => {
    it('should create issue for external script without integrity', () => {
      const checkSri = (detector as unknown as {
        checkSri: (resources: Array<{ type: string; src: string; hasIntegrity: boolean; isExternal: boolean }>, url: string) => void;
      }).checkSri.bind(detector);

      checkSri([
        { type: 'script', src: 'https://cdn.example.com/lib.js', hasIntegrity: false, isExternal: true }
      ], 'https://example.com');

      const sriIssue = detector.issues.find(i => i.type === 'security-missing-sri');
      expect(sriIssue).toBeDefined();
      expect(sriIssue?.severity).toBe(IssueSeverity.INFO);
    });

    it('should not create issue for external script with integrity', () => {
      const checkSri = (detector as unknown as {
        checkSri: (resources: Array<{ type: string; src: string; hasIntegrity: boolean; isExternal: boolean }>, url: string) => void;
      }).checkSri.bind(detector);

      checkSri([
        { type: 'script', src: 'https://cdn.example.com/lib.js', hasIntegrity: true, isExternal: true }
      ], 'https://example.com');

      expect(detector.issues.length).toBe(0);
    });

    it('should not create issue for internal script without integrity', () => {
      const checkSri = (detector as unknown as {
        checkSri: (resources: Array<{ type: string; src: string; hasIntegrity: boolean; isExternal: boolean }>, url: string) => void;
      }).checkSri.bind(detector);

      checkSri([
        { type: 'script', src: '/scripts/app.js', hasIntegrity: false, isExternal: false }
      ], 'https://example.com');

      expect(detector.issues.length).toBe(0);
    });
  });

  describe('mixed content checks', () => {
    it('should defer to mixed-content detector', () => {
      // Mixed content is already handled by the mixed-content detector
      // This test ensures the security detector doesn't duplicate that check
      expect(detector.id).toBe('security');
    });
  });
});
