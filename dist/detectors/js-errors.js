import { BaseDetector, IssueCategory, IssueSeverity } from './base.js';
/**
 * Detector for JavaScript errors, console errors, and unhandled rejections
 */
export class JavaScriptErrorsDetector extends BaseDetector {
    id = 'js-errors';
    name = 'JavaScript Errors';
    description = 'Detects JavaScript errors, console errors, and unhandled promise rejections';
    category = IssueCategory.JAVASCRIPT;
    async attach(page, _config) {
        // Listen for uncaught exceptions
        page.on('pageerror', (error) => {
            this.addIssue(this.createIssue('js-error', `Uncaught exception: ${error.message}`, IssueSeverity.ERROR, page.url(), {
                details: error.stack
            }));
        });
        // Listen for console errors
        page.on('console', (msg) => {
            if (msg.type() === 'error') {
                this.addIssue(this.createIssue('console-error', `Console error: ${msg.text()}`, IssueSeverity.WARNING, page.url(), {
                    details: msg.location().url
                }));
            }
        });
        // Inject script to capture unhandled rejections
        await page.addInitScript(() => {
            globalThis.__reproUnhandledRejections = [];
            globalThis.addEventListener('unhandledrejection', (event) => {
                globalThis.__reproUnhandledRejections.push({
                    reason: event.reason?.toString() || 'Unknown rejection',
                    stack: event.reason?.stack || '',
                    timestamp: Date.now()
                });
            });
        });
    }
    async scan(page, _config) {
        // Retrieve unhandled rejections from the page
        const rejections = await page.evaluate(() => {
            return (globalThis.__reproUnhandledRejections || []);
        });
        // Convert to issues
        const issues = rejections.map((rejection) => this.createIssue('unhandled-rejection', `Unhandled promise rejection: ${rejection.reason}`, IssueSeverity.ERROR, page.url(), {
            details: rejection.stack
        }));
        // Add to our collection
        issues.forEach((issue) => this.addIssue(issue));
        return issues;
    }
}
//# sourceMappingURL=js-errors.js.map