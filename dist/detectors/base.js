/**
 * Severity levels for detected issues
 */
export var IssueSeverity;
(function (IssueSeverity) {
    IssueSeverity["CRITICAL"] = "critical";
    IssueSeverity["ERROR"] = "error";
    IssueSeverity["WARNING"] = "warning";
    IssueSeverity["INFO"] = "info";
})(IssueSeverity || (IssueSeverity = {}));
/**
 * Categories of issues that can be detected
 */
export var IssueCategory;
(function (IssueCategory) {
    IssueCategory["JAVASCRIPT"] = "javascript";
    IssueCategory["NETWORK"] = "network";
    IssueCategory["ASSETS"] = "assets";
    IssueCategory["ACCESSIBILITY"] = "accessibility";
    IssueCategory["PERFORMANCE"] = "performance";
    IssueCategory["SECURITY"] = "security";
    IssueCategory["LINKS"] = "links";
})(IssueCategory || (IssueCategory = {}));
/**
 * Abstract base class with common detector functionality
 */
export class BaseDetector {
    issues = [];
    startTime = 0;
    /**
     * Helper to create an issue with common fields pre-filled
     */
    createIssue(type, message, severity, url, options = {}) {
        return {
            type,
            message,
            severity,
            category: this.category,
            url,
            timestamp: Date.now(),
            ...options
        };
    }
    /**
     * Helper to add an issue to the collection
     */
    addIssue(issue) {
        this.issues.push(issue);
    }
    /**
     * Default implementation of setup hook
     */
    async setup(_config) {
        this.issues = [];
        this.startTime = Date.now();
    }
    /**
     * Default implementation of collect hook
     * Collects accumulated issues and clears them for the next page
     */
    async collect(page) {
        const endTime = Date.now();
        const result = {
            detector: this.id,
            url: page.url(),
            startTime: this.startTime,
            endTime,
            duration: endTime - this.startTime,
            issues: [...this.issues] // Copy the issues array
        };
        // Clear issues for next page
        this.issues = [];
        // Reset start time for next page
        this.startTime = Date.now();
        return result;
    }
    /**
     * Default implementation of cleanup hook
     */
    async cleanup() {
        this.issues = [];
    }
}
//# sourceMappingURL=base.js.map