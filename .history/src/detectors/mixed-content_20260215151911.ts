import type { Page } from '@playwright/test';
import { BaseDetector, IssueCategory, IssueSeverity, type DetectorConfig } from './base.js';

/**
 * Detector for mixed content issues (HTTP resources on HTTPS pages)
 */
export class MixedContentDetector extends BaseDetector {
  readonly id = 'mixed-content';
  readonly name = 'Mixed Content';
  readonly description = 'Detects insecure HTTP resources loaded on HTTPS pages';
  readonly category = IssueCategory.SECURITY;
  
  async attach(page: Page, _config?: DetectorConfig): Promise<void> {
    // Listen for all requests
    page.on('request', (request) => {
      const pageUrl = page.url();
      const requestUrl = request.url();
      
      try {
        const pageUrlObj = new URL(pageUrl);
        const requestUrlObj = new URL(requestUrl);
        
        // Check if page is HTTPS but resource is HTTP
        if (pageUrlObj.protocol === 'https:' && requestUrlObj.protocol === 'http:') {
          const resourceType = request.resourceType();
          
          // Determine severity based on resource type
          let severity: IssueSeverity;
          
          // Active mixed content (scripts, stylesheets, etc.) is more critical
          if (['script', 'stylesheet', 'document', 'xhr', 'fetch', 'websocket'].includes(resourceType)) {
            severity = IssueSeverity.CRITICAL;
          } else {
            // Passive mixed content (images, media) is less critical
            severity = IssueSeverity.WARNING;
          }
          
          this.addIssue(
            this.createIssue(
              `mixed-content-${resourceType}`,
              `Insecure ${resourceType} loaded over HTTP: ${requestUrl}`,
              severity,
              pageUrl,
              {
                details: JSON.stringify({
                  resourceUrl: requestUrl,
                  resourceType,
                  pageProtocol: 'https',
                  resourceProtocol: 'http',
                  isActiveContent: ['script', 'stylesheet', 'document', 'xhr', 'fetch', 'websocket'].includes(resourceType)
                }, null, 2)
              }
            )
          );
        }
      } catch (error) {
        // Invalid URL, skip
      }
    });
  }
}
