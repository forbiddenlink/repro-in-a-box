import type { Page } from '@playwright/test';
import { BaseDetector, IssueCategory, IssueSeverity, type DetectorConfig, type Issue } from './base.js';

/** SEO metadata extracted from page */
interface SeoMetadata {
  title: string | null;
  description: string | null;
  canonical: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  ogType: string | null;
  twitterCard: string | null;
  twitterTitle: string | null;
  twitterDescription: string | null;
  twitterImage: string | null;
  h1Count: number;
  h1Text: string[];
  robots: string | null;
  viewport: string | null;
  lang: string | null;
  jsonLd: string[];
}

/** SEO thresholds */
const SEO_LIMITS = {
  TITLE_MIN: 30,
  TITLE_MAX: 60,
  DESCRIPTION_MIN: 120,
  DESCRIPTION_MAX: 160,
};

/**
 * Detector for SEO issues including meta tags, Open Graph, Twitter Cards, and structured data
 */
export class SeoDetector extends BaseDetector {
  readonly id = 'seo';
  readonly name = 'SEO';
  readonly description = 'Detects SEO issues: meta tags, Open Graph, Twitter Cards, structured data';
  readonly category = IssueCategory.SEO;

  attach(_page: Page, _config?: DetectorConfig): Promise<void> {
    return Promise.resolve();
  }

  async scan(page: Page, _config?: DetectorConfig): Promise<Issue[]> {
    try {
      const url = page.url();
      const metadata = await this.extractMetadata(page);

      // Check title
      this.checkTitle(metadata, url);

      // Check meta description
      this.checkDescription(metadata, url);

      // Check canonical URL
      this.checkCanonical(metadata, url);

      // Check Open Graph tags
      this.checkOpenGraph(metadata, url);

      // Check Twitter Card tags
      this.checkTwitterCard(metadata, url);

      // Check H1 tags
      this.checkH1Tags(metadata, url);

      // Check viewport
      this.checkViewport(metadata, url);

      // Check lang attribute
      this.checkLang(metadata, url);

      // Check structured data
      this.checkStructuredData(metadata, url);

      return this.issues;
    } catch (error) {
      console.error('SEO scan failed:', error);
      return this.issues;
    }
  }

  private async extractMetadata(page: Page): Promise<SeoMetadata> {
    // Extract metadata using individual locator queries for type safety
    const title = await page.title();

    const getMeta = async (name: string): Promise<string | null> => {
      const el = await page.$(`meta[name="${name}"], meta[property="${name}"]`);
      return el ? await el.getAttribute('content') : null;
    };

    const h1Text = await page.$$eval('h1', (elements: Element[]) =>
      elements.map(el => el.textContent?.trim() ?? '').filter((t): t is string => !!t)
    );

    const jsonLd = await page.$$eval('script[type="application/ld+json"]', (scripts: Element[]) =>
      scripts.map(s => s.textContent?.trim() ?? '').filter((t): t is string => !!t)
    );

    const canonical = await page.$eval('link[rel="canonical"]', (el: Element) => el.getAttribute('href')).catch(() => null);
    const lang: string | null = await page.$eval('html', (el: Element) => el.getAttribute('lang')).catch(() => null);

    return {
      title: title || null,
      description: await getMeta('description'),
      canonical,
      ogTitle: await getMeta('og:title'),
      ogDescription: await getMeta('og:description'),
      ogImage: await getMeta('og:image'),
      ogType: await getMeta('og:type'),
      twitterCard: await getMeta('twitter:card'),
      twitterTitle: await getMeta('twitter:title'),
      twitterDescription: await getMeta('twitter:description'),
      twitterImage: await getMeta('twitter:image'),
      h1Count: h1Text.length,
      h1Text,
      robots: await getMeta('robots'),
      viewport: await getMeta('viewport'),
      lang,
      jsonLd,
    };
  }

  private checkTitle(metadata: SeoMetadata, url: string): void {
    if (!metadata.title) {
      this.addIssue(this.createIssue(
        'seo-missing-title',
        'Missing page title',
        IssueSeverity.ERROR,
        url,
        { details: JSON.stringify({ recommendation: 'Add a <title> tag to the page' }, null, 2) }
      ));
    } else if (metadata.title.length < SEO_LIMITS.TITLE_MIN) {
      this.addIssue(this.createIssue(
        'seo-title-short',
        `Title too short (${metadata.title.length} chars, min ${SEO_LIMITS.TITLE_MIN})`,
        IssueSeverity.WARNING,
        url,
        { details: JSON.stringify({ title: metadata.title, length: metadata.title.length }, null, 2) }
      ));
    } else if (metadata.title.length > SEO_LIMITS.TITLE_MAX) {
      this.addIssue(this.createIssue(
        'seo-title-long',
        `Title too long (${metadata.title.length} chars, max ${SEO_LIMITS.TITLE_MAX})`,
        IssueSeverity.WARNING,
        url,
        { details: JSON.stringify({ title: metadata.title, length: metadata.title.length }, null, 2) }
      ));
    }
  }

  private checkDescription(metadata: SeoMetadata, url: string): void {
    if (!metadata.description) {
      this.addIssue(this.createIssue(
        'seo-missing-description',
        'Missing meta description',
        IssueSeverity.WARNING,
        url,
        { details: JSON.stringify({ recommendation: 'Add a <meta name="description"> tag' }, null, 2) }
      ));
    } else if (metadata.description.length < SEO_LIMITS.DESCRIPTION_MIN) {
      this.addIssue(this.createIssue(
        'seo-description-short',
        `Meta description too short (${metadata.description.length} chars, min ${SEO_LIMITS.DESCRIPTION_MIN})`,
        IssueSeverity.INFO,
        url,
        { details: JSON.stringify({ description: metadata.description, length: metadata.description.length }, null, 2) }
      ));
    } else if (metadata.description.length > SEO_LIMITS.DESCRIPTION_MAX) {
      this.addIssue(this.createIssue(
        'seo-description-long',
        `Meta description too long (${metadata.description.length} chars, max ${SEO_LIMITS.DESCRIPTION_MAX})`,
        IssueSeverity.INFO,
        url,
        { details: JSON.stringify({ description: metadata.description, length: metadata.description.length }, null, 2) }
      ));
    }
  }

  private checkCanonical(metadata: SeoMetadata, url: string): void {
    if (!metadata.canonical) {
      this.addIssue(this.createIssue(
        'seo-missing-canonical',
        'Missing canonical URL',
        IssueSeverity.INFO,
        url,
        { details: JSON.stringify({ recommendation: 'Add <link rel="canonical" href="..."> to prevent duplicate content' }, null, 2) }
      ));
    }
  }

  private checkOpenGraph(metadata: SeoMetadata, url: string): void {
    const missingOg: string[] = [];
    if (!metadata.ogTitle) missingOg.push('og:title');
    if (!metadata.ogDescription) missingOg.push('og:description');
    if (!metadata.ogImage) missingOg.push('og:image');

    if (missingOg.length > 0) {
      this.addIssue(this.createIssue(
        'seo-missing-og',
        `Missing Open Graph tags: ${missingOg.join(', ')}`,
        IssueSeverity.INFO,
        url,
        { details: JSON.stringify({ missingTags: missingOg, impact: 'Social media sharing may not display correctly' }, null, 2) }
      ));
    }
  }

  private checkTwitterCard(metadata: SeoMetadata, url: string): void {
    if (!metadata.twitterCard) {
      this.addIssue(this.createIssue(
        'seo-missing-twitter-card',
        'Missing Twitter Card meta tag',
        IssueSeverity.INFO,
        url,
        { details: JSON.stringify({ recommendation: 'Add <meta name="twitter:card" content="summary_large_image">' }, null, 2) }
      ));
    }
  }

  private checkH1Tags(metadata: SeoMetadata, url: string): void {
    if (metadata.h1Count === 0) {
      this.addIssue(this.createIssue(
        'seo-missing-h1',
        'Page has no H1 heading',
        IssueSeverity.WARNING,
        url,
        { details: JSON.stringify({ recommendation: 'Add exactly one <h1> tag for the main heading' }, null, 2) }
      ));
    } else if (metadata.h1Count > 1) {
      this.addIssue(this.createIssue(
        'seo-multiple-h1',
        `Page has ${metadata.h1Count} H1 headings (should be 1)`,
        IssueSeverity.INFO,
        url,
        { details: JSON.stringify({ h1Texts: metadata.h1Text, recommendation: 'Use only one H1 per page' }, null, 2) }
      ));
    }
  }

  private checkViewport(metadata: SeoMetadata, url: string): void {
    if (!metadata.viewport) {
      this.addIssue(this.createIssue(
        'seo-missing-viewport',
        'Missing viewport meta tag',
        IssueSeverity.WARNING,
        url,
        { details: JSON.stringify({ recommendation: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">' }, null, 2) }
      ));
    }
  }

  private checkLang(metadata: SeoMetadata, url: string): void {
    if (!metadata.lang) {
      this.addIssue(this.createIssue(
        'seo-missing-lang',
        'Missing lang attribute on <html> element',
        IssueSeverity.WARNING,
        url,
        { details: JSON.stringify({ recommendation: 'Add lang="en" (or appropriate language) to <html>' }, null, 2) }
      ));
    }
  }

  private checkStructuredData(metadata: SeoMetadata, url: string): void {
    if (metadata.jsonLd.length === 0) {
      this.addIssue(this.createIssue(
        'seo-no-structured-data',
        'No structured data (JSON-LD) found',
        IssueSeverity.INFO,
        url,
        { details: JSON.stringify({ recommendation: 'Add JSON-LD structured data for rich search results' }, null, 2) }
      ));
    } else {
      // Validate JSON-LD is valid JSON
      for (let i = 0; i < metadata.jsonLd.length; i++) {
        try {
          JSON.parse(metadata.jsonLd[i]);
        } catch {
          this.addIssue(this.createIssue(
            'seo-invalid-jsonld',
            `Invalid JSON-LD structured data (block ${i + 1})`,
            IssueSeverity.ERROR,
            url,
            { details: JSON.stringify({ error: 'JSON parse error', block: i + 1 }, null, 2) }
          ));
        }
      }
    }
  }
}
