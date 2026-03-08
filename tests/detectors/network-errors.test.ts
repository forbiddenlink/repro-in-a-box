import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NetworkErrorsDetector } from '../../src/detectors/network-errors.js';
import { IssueCategory, IssueSeverity } from '../../src/detectors/base.js';
import type { Page, Request, Response } from '@playwright/test';

describe('NetworkErrorsDetector', () => {
  let detector: NetworkErrorsDetector;
  let mockPage: Partial<Page>;
  let responseHandler: ((response: Partial<Response>) => void) | null = null;
  let requestFailedHandler: ((request: Partial<Request>) => void) | null = null;

  beforeEach(() => {
    detector = new NetworkErrorsDetector();
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
      expect(detector.id).toBe('network-errors');
    });

    it('should have correct name', () => {
      expect(detector.name).toBe('Network Errors');
    });

    it('should have correct category', () => {
      expect(detector.category).toBe(IssueCategory.NETWORK);
    });

    it('should have description mentioning network errors', () => {
      expect(detector.description).toContain('HTTP');
      expect(detector.description).toContain('network');
    });
  });

  describe('attach', () => {
    it('should register response and requestfailed listeners', async () => {
      await detector.attach(mockPage as Page);
      expect(mockPage.on).toHaveBeenCalledWith('response', expect.any(Function));
      expect(mockPage.on).toHaveBeenCalledWith('requestfailed', expect.any(Function));
    });
  });

  describe('request failure handling', () => {
    beforeEach(async () => {
      await detector.attach(mockPage as Page);
    });

    const createMockFailedRequest = (errorText: string): Partial<Request> => ({
      url: () => 'https://api.example.com/data',
      method: () => 'GET',
      resourceType: () => 'fetch',
      headers: () => ({}),
      failure: () => ({ errorText })
    });

    it('should report timeout errors as WARNING', () => {
      requestFailedHandler!(createMockFailedRequest('net::ERR_TIMED_OUT'));
      expect(detector.issues).toHaveLength(1);
      expect(detector.issues[0].type).toBe('request-failed');
      expect(detector.issues[0].severity).toBe(IssueSeverity.WARNING);
    });

    it('should report timeout (lowercase) errors as WARNING', () => {
      requestFailedHandler!(createMockFailedRequest('Connection timeout'));
      expect(detector.issues).toHaveLength(1);
      expect(detector.issues[0].severity).toBe(IssueSeverity.WARNING);
    });

    it('should report REFUSED errors as CRITICAL', () => {
      requestFailedHandler!(createMockFailedRequest('net::ERR_CONNECTION_REFUSED'));
      expect(detector.issues).toHaveLength(1);
      expect(detector.issues[0].severity).toBe(IssueSeverity.CRITICAL);
    });

    it('should report DNS errors as CRITICAL', () => {
      requestFailedHandler!(createMockFailedRequest('net::ERR_NAME_NOT_RESOLVED DNS'));
      expect(detector.issues).toHaveLength(1);
      expect(detector.issues[0].severity).toBe(IssueSeverity.CRITICAL);
    });

    it('should report generic errors as ERROR', () => {
      requestFailedHandler!(createMockFailedRequest('net::ERR_FAILED'));
      expect(detector.issues).toHaveLength(1);
      expect(detector.issues[0].severity).toBe(IssueSeverity.ERROR);
    });

    it('should handle missing errorText with fallback', () => {
      const request: Partial<Request> = {
        url: () => 'https://api.example.com/data',
        method: () => 'GET',
        resourceType: () => 'fetch',
        headers: () => ({}),
        failure: () => null
      };
      requestFailedHandler!(request);
      expect(detector.issues).toHaveLength(1);
      const details = JSON.parse(detector.issues[0].details || '{}');
      expect(details.errorText).toBe('Unknown error');
    });

    it('should include request method in details', () => {
      const request: Partial<Request> = {
        url: () => 'https://api.example.com/data',
        method: () => 'POST',
        resourceType: () => 'fetch',
        headers: () => ({ 'content-type': 'application/json' }),
        failure: () => ({ errorText: 'Connection failed' })
      };
      requestFailedHandler!(request);
      const details = JSON.parse(detector.issues[0].details || '{}');
      expect(details.method).toBe('POST');
    });

    it('should include resource type in details', () => {
      requestFailedHandler!(createMockFailedRequest('net::ERR_FAILED'));
      const details = JSON.parse(detector.issues[0].details || '{}');
      expect(details.resourceType).toBe('fetch');
    });
  });

  describe('HTTP status error handling', () => {
    beforeEach(async () => {
      await detector.attach(mockPage as Page);
    });

    const createMockResponse = (status: number, statusText: string): Partial<Response> => ({
      status: () => status,
      statusText: () => statusText,
      url: () => 'https://api.example.com/resource',
      headers: () => ({}),
      request: () => ({
        method: () => 'GET',
        resourceType: () => 'fetch'
      }) as unknown as Request
    });

    it('should detect HTTP 404 Not Found as WARNING', () => {
      responseHandler!(createMockResponse(404, 'Not Found'));
      expect(detector.issues).toHaveLength(1);
      expect(detector.issues[0].type).toBe('http-404');
      expect(detector.issues[0].severity).toBe(IssueSeverity.WARNING);
    });

    it('should detect HTTP 500 Internal Error as ERROR', () => {
      responseHandler!(createMockResponse(500, 'Internal Server Error'));
      expect(detector.issues).toHaveLength(1);
      expect(detector.issues[0].type).toBe('http-500');
      expect(detector.issues[0].severity).toBe(IssueSeverity.ERROR);
    });

    it('should detect HTTP 502 Bad Gateway as ERROR', () => {
      responseHandler!(createMockResponse(502, 'Bad Gateway'));
      expect(detector.issues).toHaveLength(1);
      expect(detector.issues[0].type).toBe('http-502');
      expect(detector.issues[0].severity).toBe(IssueSeverity.ERROR);
    });

    it('should detect HTTP 503 Service Unavailable as ERROR', () => {
      responseHandler!(createMockResponse(503, 'Service Unavailable'));
      expect(detector.issues).toHaveLength(1);
      expect(detector.issues[0].type).toBe('http-503');
      expect(detector.issues[0].severity).toBe(IssueSeverity.ERROR);
    });

    it('should detect HTTP 403 Forbidden as WARNING', () => {
      responseHandler!(createMockResponse(403, 'Forbidden'));
      expect(detector.issues).toHaveLength(1);
      expect(detector.issues[0].type).toBe('http-403');
      expect(detector.issues[0].severity).toBe(IssueSeverity.WARNING);
    });

    it('should detect HTTP 400 Bad Request as WARNING', () => {
      responseHandler!(createMockResponse(400, 'Bad Request'));
      expect(detector.issues).toHaveLength(1);
      expect(detector.issues[0].type).toBe('http-400');
      expect(detector.issues[0].severity).toBe(IssueSeverity.WARNING);
    });

    it('should ignore HTTP 200 OK', () => {
      responseHandler!(createMockResponse(200, 'OK'));
      expect(detector.issues).toHaveLength(0);
    });

    it('should ignore HTTP 301 redirects', () => {
      responseHandler!(createMockResponse(301, 'Moved Permanently'));
      expect(detector.issues).toHaveLength(0);
    });

    it('should ignore HTTP 204 No Content', () => {
      responseHandler!(createMockResponse(204, 'No Content'));
      expect(detector.issues).toHaveLength(0);
    });

    it('should include status and statusText in details', () => {
      responseHandler!(createMockResponse(404, 'Not Found'));
      const details = JSON.parse(detector.issues[0].details || '{}');
      expect(details.status).toBe(404);
      expect(details.statusText).toBe('Not Found');
    });
  });

  describe('multiple errors', () => {
    beforeEach(async () => {
      await detector.attach(mockPage as Page);
    });

    it('should track multiple simultaneous failures', () => {
      requestFailedHandler!({
        url: () => 'https://api.example.com/a',
        method: () => 'GET',
        resourceType: () => 'fetch',
        headers: () => ({}),
        failure: () => ({ errorText: 'timeout' })
      });
      requestFailedHandler!({
        url: () => 'https://api.example.com/b',
        method: () => 'GET',
        resourceType: () => 'fetch',
        headers: () => ({}),
        failure: () => ({ errorText: 'REFUSED' })
      });
      expect(detector.issues).toHaveLength(2);
    });

    it('should track both failed requests and HTTP errors', () => {
      requestFailedHandler!({
        url: () => 'https://api.example.com/fail',
        method: () => 'GET',
        resourceType: () => 'fetch',
        headers: () => ({}),
        failure: () => ({ errorText: 'Connection failed' })
      });
      responseHandler!({
        status: () => 500,
        statusText: () => 'Internal Server Error',
        url: () => 'https://api.example.com/error',
        headers: () => ({}),
        request: () => ({
          method: () => 'GET',
          resourceType: () => 'fetch'
        }) as unknown as Request
      });
      expect(detector.issues).toHaveLength(2);
      expect(detector.issues[0].type).toBe('request-failed');
      expect(detector.issues[1].type).toBe('http-500');
    });
  });

  describe('cleanup', () => {
    it('should clear issues on cleanup', async () => {
      await detector.attach(mockPage as Page);
      requestFailedHandler!({
        url: () => 'https://api.example.com/fail',
        method: () => 'GET',
        resourceType: () => 'fetch',
        headers: () => ({}),
        failure: () => ({ errorText: 'error' })
      });
      expect(detector.issues).toHaveLength(1);

      await detector.cleanup();
      expect(detector.issues).toHaveLength(0);
    });
  });
});
