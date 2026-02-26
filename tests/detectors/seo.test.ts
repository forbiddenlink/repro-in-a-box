import { describe, it, expect, beforeEach } from 'vitest';
import { SeoDetector } from '../../src/detectors/seo.js';
import { IssueCategory } from '../../src/detectors/base.js';

describe('SeoDetector', () => {
  let detector: SeoDetector;

  beforeEach(() => {
    detector = new SeoDetector();
  });

  describe('metadata', () => {
    it('should have correct id', () => {
      expect(detector.id).toBe('seo');
    });

    it('should have correct name', () => {
      expect(detector.name).toBe('SEO');
    });

    it('should have correct category', () => {
      expect(detector.category).toBe(IssueCategory.SEO);
    });

    it('should have description mentioning key features', () => {
      expect(detector.description).toContain('meta tags');
      expect(detector.description).toContain('Open Graph');
    });
  });

  describe('title checks', () => {
    it('should create issue for missing title via checkTitle', () => {
      const checkTitle = (detector as unknown as {
        checkTitle: (metadata: { title: string | null }, url: string) => void;
        addIssue: (issue: unknown) => void;
        createIssue: (...args: unknown[]) => unknown;
      }).checkTitle.bind(detector);

      checkTitle({ title: null }, 'https://example.com');
      expect(detector.issues.length).toBe(1);
      expect(detector.issues[0].type).toBe('seo-missing-title');
    });

    it('should create issue for short title', () => {
      const checkTitle = (detector as unknown as {
        checkTitle: (metadata: { title: string | null }, url: string) => void;
      }).checkTitle.bind(detector);

      checkTitle({ title: 'Short' }, 'https://example.com');
      expect(detector.issues.length).toBe(1);
      expect(detector.issues[0].type).toBe('seo-title-short');
    });

    it('should create issue for long title', () => {
      const checkTitle = (detector as unknown as {
        checkTitle: (metadata: { title: string | null }, url: string) => void;
      }).checkTitle.bind(detector);

      const longTitle = 'This is a very long title that exceeds the maximum recommended length for SEO purposes';
      checkTitle({ title: longTitle }, 'https://example.com');
      expect(detector.issues.length).toBe(1);
      expect(detector.issues[0].type).toBe('seo-title-long');
    });

    it('should not create issue for good title length', () => {
      const checkTitle = (detector as unknown as {
        checkTitle: (metadata: { title: string | null }, url: string) => void;
      }).checkTitle.bind(detector);

      checkTitle({ title: 'This is a good title for SEO purposes' }, 'https://example.com');
      expect(detector.issues.length).toBe(0);
    });
  });

  describe('description checks', () => {
    it('should create issue for missing description', () => {
      const checkDescription = (detector as unknown as {
        checkDescription: (metadata: { description: string | null }, url: string) => void;
      }).checkDescription.bind(detector);

      checkDescription({ description: null }, 'https://example.com');
      expect(detector.issues.length).toBe(1);
      expect(detector.issues[0].type).toBe('seo-missing-description');
    });
  });

  describe('H1 checks', () => {
    it('should create issue for missing H1', () => {
      const checkH1Tags = (detector as unknown as {
        checkH1Tags: (metadata: { h1Count: number; h1Text: string[] }, url: string) => void;
      }).checkH1Tags.bind(detector);

      checkH1Tags({ h1Count: 0, h1Text: [] }, 'https://example.com');
      expect(detector.issues.length).toBe(1);
      expect(detector.issues[0].type).toBe('seo-missing-h1');
    });

    it('should create issue for multiple H1s', () => {
      const checkH1Tags = (detector as unknown as {
        checkH1Tags: (metadata: { h1Count: number; h1Text: string[] }, url: string) => void;
      }).checkH1Tags.bind(detector);

      checkH1Tags({ h1Count: 3, h1Text: ['First', 'Second', 'Third'] }, 'https://example.com');
      expect(detector.issues.length).toBe(1);
      expect(detector.issues[0].type).toBe('seo-multiple-h1');
    });

    it('should not create issue for single H1', () => {
      const checkH1Tags = (detector as unknown as {
        checkH1Tags: (metadata: { h1Count: number; h1Text: string[] }, url: string) => void;
      }).checkH1Tags.bind(detector);

      checkH1Tags({ h1Count: 1, h1Text: ['Main Heading'] }, 'https://example.com');
      expect(detector.issues.length).toBe(0);
    });
  });

  describe('Open Graph checks', () => {
    it('should create issue for missing OG tags', () => {
      const checkOpenGraph = (detector as unknown as {
        checkOpenGraph: (metadata: { ogTitle: string | null; ogDescription: string | null; ogImage: string | null }, url: string) => void;
      }).checkOpenGraph.bind(detector);

      checkOpenGraph({ ogTitle: null, ogDescription: null, ogImage: null }, 'https://example.com');
      expect(detector.issues.length).toBe(1);
      expect(detector.issues[0].type).toBe('seo-missing-og');
    });

    it('should not create issue when all OG tags present', () => {
      const checkOpenGraph = (detector as unknown as {
        checkOpenGraph: (metadata: { ogTitle: string | null; ogDescription: string | null; ogImage: string | null }, url: string) => void;
      }).checkOpenGraph.bind(detector);

      checkOpenGraph({ ogTitle: 'Title', ogDescription: 'Desc', ogImage: 'img.png' }, 'https://example.com');
      expect(detector.issues.length).toBe(0);
    });
  });

  describe('structured data checks', () => {
    it('should create issue for missing JSON-LD', () => {
      const checkStructuredData = (detector as unknown as {
        checkStructuredData: (metadata: { jsonLd: string[] }, url: string) => void;
      }).checkStructuredData.bind(detector);

      checkStructuredData({ jsonLd: [] }, 'https://example.com');
      expect(detector.issues.length).toBe(1);
      expect(detector.issues[0].type).toBe('seo-no-structured-data');
    });

    it('should create issue for invalid JSON-LD', () => {
      const checkStructuredData = (detector as unknown as {
        checkStructuredData: (metadata: { jsonLd: string[] }, url: string) => void;
      }).checkStructuredData.bind(detector);

      checkStructuredData({ jsonLd: ['not valid json'] }, 'https://example.com');
      expect(detector.issues.length).toBe(1);
      expect(detector.issues[0].type).toBe('seo-invalid-jsonld');
    });

    it('should not create issue for valid JSON-LD', () => {
      const checkStructuredData = (detector as unknown as {
        checkStructuredData: (metadata: { jsonLd: string[] }, url: string) => void;
      }).checkStructuredData.bind(detector);

      checkStructuredData({ jsonLd: ['{"@type": "Organization"}'] }, 'https://example.com');
      expect(detector.issues.length).toBe(0);
    });
  });
});
