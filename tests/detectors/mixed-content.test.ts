import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MixedContentDetector } from '../../src/detectors/mixed-content.js';
import { IssueCategory, IssueSeverity } from '../../src/detectors/base.js';
import type { Page, Request } from '@playwright/test';

describe('MixedContentDetector', () => {
  let detector: MixedContentDetector;
  let mockPage: Partial<Page>;
  let requestHandler: ((request: Partial<Request>) => void) | null = null;

  beforeEach(() => {
    detector = new MixedContentDetector();
    requestHandler = null;

    mockPage = {
      url: vi.fn().mockReturnValue('https://secure.example.com/page'),
      on: vi.fn((event: string, handler: unknown) => {
        if (event === 'request') {
          requestHandler = handler as (request: Partial<Request>) => void;
        }
      })
    };
  });

  describe('metadata', () => {
    it('should have correct id', () => {
      expect(detector.id).toBe('mixed-content');
    });

    it('should have correct name', () => {
      expect(detector.name).toBe('Mixed Content');
    });

    it('should have correct category', () => {
      expect(detector.category).toBe(IssueCategory.SECURITY);
    });

    it('should have description mentioning HTTP and HTTPS', () => {
      expect(detector.description).toContain('HTTP');
      expect(detector.description).toContain('HTTPS');
    });
  });

  describe('attach', () => {
    it('should register request listener', async () => {
      await detector.attach(mockPage as Page);
      expect(mockPage.on).toHaveBeenCalledWith('request', expect.any(Function));
    });
  });

  describe('active mixed content (CRITICAL)', () => {
    beforeEach(async () => {
      await detector.attach(mockPage as Page);
    });

    const createMockRequest = (url: string, resourceType: string): Partial<Request> => ({
      url: () => url,
      resourceType: () => resourceType
    });

    it('should detect HTTP script on HTTPS page as CRITICAL', () => {
      requestHandler!(createMockRequest('http://cdn.example.com/app.js', 'script'));
      expect(detector.issues).toHaveLength(1);
      expect(detector.issues[0].type).toBe('mixed-content-script');
      expect(detector.issues[0].severity).toBe(IssueSeverity.CRITICAL);
    });

    it('should detect HTTP stylesheet on HTTPS page as CRITICAL', () => {
      requestHandler!(createMockRequest('http://cdn.example.com/styles.css', 'stylesheet'));
      expect(detector.issues).toHaveLength(1);
      expect(detector.issues[0].type).toBe('mixed-content-stylesheet');
      expect(detector.issues[0].severity).toBe(IssueSeverity.CRITICAL);
    });

    it('should detect HTTP document on HTTPS page as CRITICAL', () => {
      requestHandler!(createMockRequest('http://iframe.example.com/frame.html', 'document'));
      expect(detector.issues).toHaveLength(1);
      expect(detector.issues[0].type).toBe('mixed-content-document');
      expect(detector.issues[0].severity).toBe(IssueSeverity.CRITICAL);
    });

    it('should detect HTTP xhr on HTTPS page as CRITICAL', () => {
      requestHandler!(createMockRequest('http://api.example.com/data', 'xhr'));
      expect(detector.issues).toHaveLength(1);
      expect(detector.issues[0].type).toBe('mixed-content-xhr');
      expect(detector.issues[0].severity).toBe(IssueSeverity.CRITICAL);
    });

    it('should detect HTTP fetch on HTTPS page as CRITICAL', () => {
      requestHandler!(createMockRequest('http://api.example.com/resource', 'fetch'));
      expect(detector.issues).toHaveLength(1);
      expect(detector.issues[0].type).toBe('mixed-content-fetch');
      expect(detector.issues[0].severity).toBe(IssueSeverity.CRITICAL);
    });

    it('should detect HTTP websocket on HTTPS page as CRITICAL', () => {
      requestHandler!(createMockRequest('http://ws.example.com/socket', 'websocket'));
      expect(detector.issues).toHaveLength(1);
      expect(detector.issues[0].type).toBe('mixed-content-websocket');
      expect(detector.issues[0].severity).toBe(IssueSeverity.CRITICAL);
    });
  });

  describe('passive mixed content (WARNING)', () => {
    beforeEach(async () => {
      await detector.attach(mockPage as Page);
    });

    const createMockRequest = (url: string, resourceType: string): Partial<Request> => ({
      url: () => url,
      resourceType: () => resourceType
    });

    it('should detect HTTP image on HTTPS page as WARNING', () => {
      requestHandler!(createMockRequest('http://images.example.com/photo.jpg', 'image'));
      expect(detector.issues).toHaveLength(1);
      expect(detector.issues[0].type).toBe('mixed-content-image');
      expect(detector.issues[0].severity).toBe(IssueSeverity.WARNING);
    });

    it('should detect HTTP media on HTTPS page as WARNING', () => {
      requestHandler!(createMockRequest('http://media.example.com/video.mp4', 'media'));
      expect(detector.issues).toHaveLength(1);
      expect(detector.issues[0].type).toBe('mixed-content-media');
      expect(detector.issues[0].severity).toBe(IssueSeverity.WARNING);
    });

    it('should detect HTTP font on HTTPS page as WARNING', () => {
      requestHandler!(createMockRequest('http://fonts.example.com/font.woff2', 'font'));
      expect(detector.issues).toHaveLength(1);
      expect(detector.issues[0].type).toBe('mixed-content-font');
      expect(detector.issues[0].severity).toBe(IssueSeverity.WARNING);
    });
  });

  describe('non-mixed content scenarios', () => {
    const createMockRequest = (url: string, resourceType: string): Partial<Request> => ({
      url: () => url,
      resourceType: () => resourceType
    });

    it('should not flag HTTPS resource on HTTPS page', async () => {
      await detector.attach(mockPage as Page);
      requestHandler!(createMockRequest('https://cdn.example.com/script.js', 'script'));
      expect(detector.issues).toHaveLength(0);
    });

    it('should not flag HTTP resource on HTTP page', async () => {
      mockPage.url = vi.fn().mockReturnValue('http://example.com/page');
      await detector.attach(mockPage as Page);
      requestHandler!(createMockRequest('http://cdn.example.com/script.js', 'script'));
      expect(detector.issues).toHaveLength(0);
    });

    it('should not flag HTTPS resource on HTTP page', async () => {
      mockPage.url = vi.fn().mockReturnValue('http://example.com/page');
      await detector.attach(mockPage as Page);
      requestHandler!(createMockRequest('https://cdn.example.com/script.js', 'script'));
      expect(detector.issues).toHaveLength(0);
    });
  });

  describe('URL parsing edge cases', () => {
    beforeEach(async () => {
      await detector.attach(mockPage as Page);
    });

    it('should handle invalid resource URL gracefully', () => {
      const request: Partial<Request> = {
        url: () => 'not-a-valid-url',
        resourceType: () => 'script'
      };
      // Should not throw
      expect(() => requestHandler!(request)).not.toThrow();
      expect(detector.issues).toHaveLength(0);
    });

    it('should handle unusual port numbers', () => {
      const request: Partial<Request> = {
        url: () => 'http://cdn.example.com:8080/script.js',
        resourceType: () => 'script'
      };
      requestHandler!(request);
      expect(detector.issues).toHaveLength(1);
      expect(detector.issues[0].severity).toBe(IssueSeverity.CRITICAL);
    });
  });

  describe('issue details', () => {
    beforeEach(async () => {
      await detector.attach(mockPage as Page);
    });

    it('should include resourceUrl in details', () => {
      requestHandler!({
        url: () => 'http://cdn.example.com/script.js',
        resourceType: () => 'script'
      });
      const details = JSON.parse(detector.issues[0].details || '{}');
      expect(details.resourceUrl).toBe('http://cdn.example.com/script.js');
    });

    it('should include resourceType in details', () => {
      requestHandler!({
        url: () => 'http://cdn.example.com/script.js',
        resourceType: () => 'script'
      });
      const details = JSON.parse(detector.issues[0].details || '{}');
      expect(details.resourceType).toBe('script');
    });

    it('should include protocol information in details', () => {
      requestHandler!({
        url: () => 'http://cdn.example.com/script.js',
        resourceType: () => 'script'
      });
      const details = JSON.parse(detector.issues[0].details || '{}');
      expect(details.pageProtocol).toBe('https');
      expect(details.resourceProtocol).toBe('http');
    });

    it('should include isActiveContent flag in details', () => {
      requestHandler!({
        url: () => 'http://cdn.example.com/script.js',
        resourceType: () => 'script'
      });
      const details = JSON.parse(detector.issues[0].details || '{}');
      expect(details.isActiveContent).toBe(true);
    });

    it('should mark passive content correctly', () => {
      requestHandler!({
        url: () => 'http://images.example.com/photo.jpg',
        resourceType: () => 'image'
      });
      const details = JSON.parse(detector.issues[0].details || '{}');
      expect(details.isActiveContent).toBe(false);
    });
  });

  describe('multiple mixed content resources', () => {
    beforeEach(async () => {
      await detector.attach(mockPage as Page);
    });

    it('should track all mixed content resources', () => {
      requestHandler!({
        url: () => 'http://cdn.example.com/script.js',
        resourceType: () => 'script'
      });
      requestHandler!({
        url: () => 'http://images.example.com/photo.jpg',
        resourceType: () => 'image'
      });
      requestHandler!({
        url: () => 'http://api.example.com/data',
        resourceType: () => 'fetch'
      });
      expect(detector.issues).toHaveLength(3);
    });
  });

  describe('cleanup', () => {
    it('should clear issues on cleanup', async () => {
      await detector.attach(mockPage as Page);
      requestHandler!({
        url: () => 'http://cdn.example.com/script.js',
        resourceType: () => 'script'
      });
      expect(detector.issues).toHaveLength(1);

      await detector.cleanup();
      expect(detector.issues).toHaveLength(0);
    });
  });
});
