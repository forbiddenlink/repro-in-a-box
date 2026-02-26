import type { Page } from '@playwright/test';
import { BaseDetector, IssueCategory, IssueSeverity, type DetectorConfig, type Issue } from './base.js';

/**
 * Detector for broken internal and external links
 */
export class BrokenLinksDetector extends BaseDetector {
  readonly id = 'broken-links';
  readonly name = 'Broken Links';
  readonly description = 'Detects broken internal and external links on the page';
  readonly category = IssueCategory.LINKS;
  
  private checkedLinks = new Set<string>();
  
  attach(page: Page, _config?: DetectorConfig): Promise<void> {
    // Listen for navigation responses to catch link clicks
    page.on('response', (response) => {
      const url = response.url();
      const status = response.status();
      const request = response.request();
      
      // Only check navigation requests (document loads)
      if (request.resourceType() === 'document' && status >= 400) {
        this.addIssue(
          this.createIssue(
            `broken-link-${status}`,
            `Broken link: ${url} (HTTP ${status})`,
            status >= 500 ? IssueSeverity.ERROR : IssueSeverity.WARNING,
            page.url(),
            {
              details: JSON.stringify({
                linkUrl: url,
                statusCode: status,
                statusText: response.statusText()
              }, null, 2)
            }
          )
        );
      }
    });

    return Promise.resolve();
  }

  async scan(page: Page, _config?: DetectorConfig): Promise<Issue[]> {
    try {
      // Extract all links from the page using $$eval for proper typing
      const links = await page.$$eval('a[href]', (anchors) =>
        anchors.map((a) => ({
          href: (a as { href?: string }).href ?? '',
          text: a.textContent?.trim() ?? '',
          rel: a.getAttribute('rel') ?? ''
        }))
      );
      
      // Check each link (limited to avoid long scan times)
      const linksToCheck = links.slice(0, 50); // Limit to first 50 links
      
      for (const link of linksToCheck) {
        // Skip already checked links
        if (this.checkedLinks.has(link.href)) {
          continue;
        }
        
        this.checkedLinks.add(link.href);
        
        // Skip non-HTTP/HTTPS links
        if (!link.href.startsWith('http://') && !link.href.startsWith('https://')) {
          continue;
        }
        
        try {
          // Make a HEAD request to check if link is alive
          const response = await page.request.head(link.href, {
            timeout: 5000,
            maxRedirects: 5
          });
          
          const status = response.status();
          
          // Report broken links (4xx, 5xx)
          if (status >= 400) {
            this.addIssue(
              this.createIssue(
                `broken-link-${status}`,
                `Broken link: "${link.text}" → ${link.href} (HTTP ${status})`,
                status >= 500 ? IssueSeverity.ERROR : IssueSeverity.WARNING,
                page.url(),
                {
                  details: JSON.stringify({
                    linkText: link.text,
                    linkUrl: link.href,
                    statusCode: status,
                    statusText: response.statusText()
                  }, null, 2)
                }
              )
            );
          }
        } catch (error) {
          // Network error, timeout, or DNS failure
          this.addIssue(
            this.createIssue(
              'broken-link-unreachable',
              `Unreachable link: "${link.text}" → ${link.href}`,
              IssueSeverity.ERROR,
              page.url(),
              {
                details: JSON.stringify({
                  linkText: link.text,
                  linkUrl: link.href,
                  error: error instanceof Error ? error.message : String(error)
                }, null, 2)
              }
            )
          );
        }
      }
      
      return this.issues;
    } catch (error) {
      console.error('Failed to check links:', error);
      return this.issues;
    }
  }
  
  async cleanup(): Promise<void> {
    await super.cleanup();
    this.checkedLinks.clear();
  }
}
