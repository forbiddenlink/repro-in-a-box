import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BrokenAssetsDetector } from '../../src/detectors/broken-assets.js';
import { IssueCategory, IssueSeverity } from '../../src/detectors/base.js';
import type { Page, Request, Response } from '@playwright/test';

describe('BrokenAssetsDetector', () => {
  let detector: BrokenAssetsDetector;
  let mockPage: Partial<Page>;
  let responseHandler: ((response: Partial<Response>) => void) | null = null;
  let requestFailedHandler: ((request: Partial<Request>) => void) | null = null;

  beforeEach(() => {
    detector = new BrokenAssetsDetector();
    responseHandler = null;
    requestFailedHandler = null;

    mockPage = {
      url: vi.fn().mockReturnValue('https://example.com/page'),
      on: vi.fn((event: string, handler: unknown) => {
        if (event === 'response') {
          responseHandler = handler as (response: Partial<Response>) => void;
        } else if (event === 'requestfailed') {
          requestFailedHandler = handler as (request: Partial<Request>) => void;
        }
      })
    };
  });

  describe('metadata', () => {
    it('should have correct id', () => {
      expect(detector.id).toBe('broken-assets');
    });

    it('should have correct name', () => {
      expect(detector.name).toBe('Broken Assets');
    });

    it('should have correct category', () => {
      expect(detector.category).toBe(IssueCategory.ASSETS);
    });

    it('should have description mentioning assets', () => {
      expect(detector.description).toContain('images');
      expect(detector.description).toContain('scripts');
    });
  });

  describe('attach', () => {
    it('should register response and requestfailed listeners', async () => {
      await detector.attach(mockPage as Page);
      expect(mockPage.on).toHaveBeenCalledWith('response', expect.any(Function));
      expect(mockPage.on).toHaveBeenCalledWith('requestfailed', expect.any(Function));
    });
  });

  describe('response handling', () => {
    beforeEach(async () => {
      await detector.attach(mockPage as Page);
    });

    const createMockResponse = (
      status: number,
      resourceType: string,
      url = 'https://example.com/asset'
    ): Partial<Response> => ({
      status: () => status,
      statusText: () => status >= 400 ? 'Error' : 'OK',
      url: () => url,
      headers: () => ({}),
      request: () => ({
        resourceType: () => resourceType,
        method: () => 'GET'
      }) as unknown as Request
    });

    it('should detect broken images (404) with WARNING severity', () => {
      responseHandler!(createMockResponse(404, 'image'));
      expect(detector.issues).toHaveLength(1);
      expect(detector.issues[0].type).toBe('broken-image');
      expect(detector.issues[0].severity).toBe(IssueSeverity.WARNING);
    });

    it('should detect broken scripts (500) with ERROR severity', () => {
      responseHandler!(createMockResponse(500, 'script'));
      expect(detector.issues).toHaveLength(1);
      expect(detector.issues[0].type).toBe('broken-script');
      expect(detector.issues[0].severity).toBe(IssueSeverity.ERROR);
    });

    it('should detect broken stylesheets (403) with ERROR severity', () => {
      responseHandler!(createMockResponse(403, 'stylesheet'));
      expect(detector.issues).toHaveLength(1);
      expect(detector.issues[0].type).toBe('broken-stylesheet');
      expect(detector.issues[0].severity).toBe(IssueSeverity.ERROR);
    });

    it('should detect broken fonts (410) with WARNING severity', () => {
      responseHandler!(createMockResponse(410, 'font'));
      expect(detector.issues).toHaveLength(1);
      expect(detector.issues[0].type).toBe('broken-font');
      expect(detector.issues[0].severity).toBe(IssueSeverity.WARNING);
    });

    it('should ignore successful responses (200)', () => {
      responseHandler!(createMockResponse(200, 'image'));
      expect(detector.issues).toHaveLength(0);
    });

    it('should ignore redirect responses (301)', () => {
      responseHandler!(createMockResponse(301, 'script'));
      expect(detector.issues).toHaveLength(0);
    });

    it('should ignore non-asset resource types', () => {
      responseHandler!(createMockResponse(404, 'document'));
      responseHandler!(createMockResponse(404, 'xhr'));
      responseHandler!(createMockResponse(404, 'fetch'));
      expect(detector.issues).toHaveLength(0);
    });

    it('should track multiple broken assets', () => {
      responseHandler!(createMockResponse(404, 'image', 'https://example.com/img1.png'));
      responseHandler!(createMockResponse(500, 'script', 'https://example.com/app.js'));
      responseHandler!(createMockResponse(404, 'stylesheet', 'https://example.com/style.css'));
      expect(detector.issues).toHaveLength(3);
    });

    it('should include status and URL in issue details', () => {
      responseHandler!(createMockResponse(404, 'image', 'https://example.com/broken.png'));
      const details = JSON.parse(detector.issues[0].details || '{}');
      expect(details.status).toBe(404);
      expect(details.url).toBe('https://example.com/broken.png');
      expect(details.resourceType).toBe('image');
    });
  });

  describe('request failure handling', () => {
    beforeEach(async () => {
      await detector.attach(mockPage as Page);
    });

    const createMockFailedRequest = (
      resourceType: string,
      errorText = 'net::ERR_CONNECTION_REFUSED'
    ): Partial<Request> => ({
      url: () => 'https://example.com/failed-asset',
      resourceType: () => resourceType,
      method: () => 'GET',
      failure: () => ({ errorText })
    });

    it('should detect failed image requests', () => {
      requestFailedHandler!(createMockFailedRequest('image'));
      expect(detector.issues).toHaveLength(1);
      expect(detector.issues[0].type).toBe('failed-image');
      expect(detector.issues[0].severity).toBe(IssueSeverity.WARNING);
    });

    it('should detect failed script requests', () => {
      requestFailedHandler!(createMockFailedRequest('script'));
      expect(detector.issues).toHaveLength(1);
      expect(detector.issues[0].type).toBe('failed-script');
    });

    it('should detect failed stylesheet requests', () => {
      requestFailedHandler!(createMockFailedRequest('stylesheet'));
      expect(detector.issues).toHaveLength(1);
      expect(detector.issues[0].type).toBe('failed-stylesheet');
    });

    it('should detect failed font requests', () => {
      requestFailedHandler!(createMockFailedRequest('font'));
      expect(detector.issues).toHaveLength(1);
      expect(detector.issues[0].type).toBe('failed-font');
    });

    it('should ignore non-asset request failures', () => {
      requestFailedHandler!(createMockFailedRequest('document'));
      requestFailedHandler!(createMockFailedRequest('xhr'));
      expect(detector.issues).toHaveLength(0);
    });

    it('should handle missing errorText gracefully', () => {
      const request: Partial<Request> = {
        url: () => 'https://example.com/asset',
        resourceType: () => 'image',
        method: () => 'GET',
        failure: () => null
      };
      requestFailedHandler!(request);
      expect(detector.issues).toHaveLength(1);
      const details = JSON.parse(detector.issues[0].details || '{}');
      expect(details.errorText).toBe('Unknown error');
    });

    it('should include error details in issue', () => {
      requestFailedHandler!(createMockFailedRequest('script', 'net::ERR_TIMED_OUT'));
      const details = JSON.parse(detector.issues[0].details || '{}');
      expect(details.errorText).toBe('net::ERR_TIMED_OUT');
      expect(details.method).toBe('GET');
    });
  });

  describe('cleanup', () => {
    it('should clear issues on cleanup', async () => {
      await detector.attach(mockPage as Page);
      responseHandler!(({
        status: () => 404,
        statusText: () => 'Not Found',
        url: () => 'https://example.com/broken.png',
        headers: () => ({}),
        request: () => ({
          resourceType: () => 'image',
          method: () => 'GET'
        }) as unknown as Request
      }));
      expect(detector.issues).toHaveLength(1);

      await detector.cleanup();
      expect(detector.issues).toHaveLength(0);
    });
  });
});
