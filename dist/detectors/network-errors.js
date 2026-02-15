import { BaseDetector, IssueCategory, IssueSeverity } from './base.js';
/**
 * Detector for network request failures, timeouts, and errors
 */
export class NetworkErrorsDetector extends BaseDetector {
    id = 'network-errors';
    name = 'Network Errors';
    description = 'Detects failed HTTP requests, timeouts, and network errors';
    category = IssueCategory.NETWORK;
    async attach(page, _config) {
        // Listen for failed requests
        page.on('requestfailed', (request) => {
            const failure = request.failure();
            const errorText = failure?.errorText || 'Unknown error';
            // Determine severity based on error type
            let severity = IssueSeverity.ERROR;
            if (errorText.includes('timeout') || errorText.includes('TIMED_OUT')) {
                severity = IssueSeverity.WARNING;
            }
            else if (errorText.includes('REFUSED') || errorText.includes('DNS')) {
                severity = IssueSeverity.CRITICAL;
            }
            this.addIssue(this.createIssue('request-failed', `Request failed: ${request.method()} ${request.url()}`, severity, page.url(), {
                details: JSON.stringify({
                    method: request.method(),
                    url: request.url(),
                    resourceType: request.resourceType(),
                    errorText,
                    headers: request.headers()
                }, null, 2)
            }));
        });
        // Listen for responses to catch HTTP errors (4xx, 5xx)
        page.on('response', (response) => {
            const status = response.status();
            // Only report errors (400+), not redirects or success codes
            if (status >= 400) {
                let severity;
                if (status >= 500) {
                    severity = IssueSeverity.ERROR;
                }
                else if (status === 404) {
                    severity = IssueSeverity.WARNING;
                }
                else {
                    severity = IssueSeverity.WARNING;
                }
                this.addIssue(this.createIssue(`http-${status}`, `HTTP ${status}: ${response.request().method()} ${response.url()}`, severity, page.url(), {
                    details: JSON.stringify({
                        status,
                        statusText: response.statusText(),
                        method: response.request().method(),
                        url: response.url(),
                        resourceType: response.request().resourceType(),
                        headers: response.headers()
                    }, null, 2)
                }));
            }
        });
    }
}
//# sourceMappingURL=network-errors.js.map