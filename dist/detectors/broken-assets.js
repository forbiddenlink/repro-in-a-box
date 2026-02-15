import { BaseDetector, IssueCategory, IssueSeverity } from './base.js';
/**
 * Detector for broken assets (images, stylesheets, scripts, fonts)
 */
export class BrokenAssetsDetector extends BaseDetector {
    id = 'broken-assets';
    name = 'Broken Assets';
    description = 'Detects broken images, stylesheets, scripts, and fonts';
    category = IssueCategory.ASSETS;
    assetTypes = ['image', 'stylesheet', 'script', 'font'];
    async attach(page, _config) {
        // Listen for responses to catch broken assets
        page.on('response', (response) => {
            const request = response.request();
            const resourceType = request.resourceType();
            const status = response.status();
            // Only check asset types and error status codes
            if (!this.assetTypes.includes(resourceType) || status < 400) {
                return;
            }
            // Determine severity based on resource type and status
            let severity;
            if (resourceType === 'script') {
                // Broken scripts can break functionality
                severity = IssueSeverity.ERROR;
            }
            else if (resourceType === 'stylesheet') {
                // Broken styles affect layout
                severity = IssueSeverity.ERROR;
            }
            else if (resourceType === 'font') {
                // Broken fonts are noticeable but not critical
                severity = IssueSeverity.WARNING;
            }
            else {
                // Broken images are usually not critical
                severity = IssueSeverity.WARNING;
            }
            this.addIssue(this.createIssue(`broken-${resourceType}`, `Broken ${resourceType}: ${response.url()}`, severity, page.url(), {
                details: JSON.stringify({
                    status,
                    statusText: response.statusText(),
                    url: response.url(),
                    resourceType,
                    method: request.method(),
                    headers: response.headers()
                }, null, 2)
            }));
        });
        // Also listen for request failures for assets
        page.on('requestfailed', (request) => {
            const resourceType = request.resourceType();
            // Only report asset failures
            if (!this.assetTypes.includes(resourceType)) {
                return;
            }
            const failure = request.failure();
            const errorText = failure?.errorText || 'Unknown error';
            // Assets that fail to load are warnings
            this.addIssue(this.createIssue(`failed-${resourceType}`, `Failed to load ${resourceType}: ${request.url()}`, IssueSeverity.WARNING, page.url(), {
                details: JSON.stringify({
                    url: request.url(),
                    resourceType,
                    errorText,
                    method: request.method()
                }, null, 2)
            }));
        });
    }
}
//# sourceMappingURL=broken-assets.js.map