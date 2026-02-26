import type { Page } from '@playwright/test';

/**
 * Severity levels for detected issues
 */
export enum IssueSeverity {
  CRITICAL = 'critical',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info'
}

/**
 * Categories of issues that can be detected
 */
export enum IssueCategory {
  JAVASCRIPT = 'javascript',
  NETWORK = 'network',
  ASSETS = 'assets',
  ACCESSIBILITY = 'accessibility',
  PERFORMANCE = 'performance',
  SECURITY = 'security',
  LINKS = 'links',
  CONSOLE = 'console',
  SEO = 'seo'
}

/**
 * An individual issue detected by a detector
 */
export interface Issue {
  /** Type of issue (e.g., 'js-error', 'network-timeout') */
  type: string;
  /** Human-readable message describing the issue */
  message: string;
  /** Severity level */
  severity: IssueSeverity;
  /** Category of the issue */
  category: IssueCategory;
  /** URL where the issue was detected */
  url: string;
  /** Optional: CSS selector for the element involved */
  selector?: string;
  /** Optional: Stack trace or additional details */
  details?: string;
  /** Optional: Screenshot path if captured */
  screenshot?: string;
  /** Timestamp when the issue was detected */
  timestamp: number;
}

/**
 * Result from running a detector on a page
 */
export interface DetectorResult {
  /** Name of the detector that produced this result */
  detector: string;
  /** URL that was scanned */
  url: string;
  /** Timestamp when detection started */
  startTime: number;
  /** Timestamp when detection completed */
  endTime: number;
  /** Duration in milliseconds */
  duration: number;
  /** List of issues found */
  issues: Issue[];
  /** Optional: Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Configuration options for detectors
 */
export interface DetectorConfig {
  /** Whether this detector is enabled */
  enabled?: boolean;
  /** Detector-specific configuration */
  options?: Record<string, unknown>;
}

/**
 * Base interface that all detectors must implement
 */
export interface Detector {
  /** Unique identifier for the detector */
  readonly id: string;
  
  /** Human-readable name */
  readonly name: string;
  
  /** Description of what this detector checks */
  readonly description: string;
  
  /** Category of issues this detector finds */
  readonly category: IssueCategory;
  
  /**
   * Setup hook: Called once before scanning begins
   * Use this to initialize any resources or state
   */
  setup?(config?: DetectorConfig): Promise<void>;
  
  /**
   * Attach hook: Called for each page before navigation
   * Use this to register event listeners, inject scripts, etc.
   */
  attach(page: Page, config?: DetectorConfig): Promise<void>;
  
  /**
   * Scan hook: Called after page loads to perform active detection
   * Use this for checks that require page interaction
   */
  scan?(page: Page, config?: DetectorConfig): Promise<Issue[]>;
  
  /**
   * Collect hook: Called to retrieve accumulated issues
   * Use this to return issues caught by event listeners
   */
  collect(page: Page): Promise<DetectorResult>;
  
  /**
   * Cleanup hook: Called after scanning completes
   * Use this to clean up resources
   */
  cleanup?(): Promise<void>;
}

/**
 * Abstract base class with common detector functionality
 */
export abstract class BaseDetector implements Detector {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly category: IssueCategory;
  
  protected issues: Issue[] = [];
  protected startTime: number = 0;
  
  /**
   * Helper to create an issue with common fields pre-filled
   */
  protected createIssue(
    type: string,
    message: string,
    severity: IssueSeverity,
    url: string,
    options: Partial<Issue> = {}
  ): Issue {
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
  protected addIssue(issue: Issue): void {
    this.issues.push(issue);
  }
  
  /**
   * Default implementation of setup hook
   */
  setup(_config?: DetectorConfig): Promise<void> {
    this.issues = [];
    this.startTime = Date.now();
    return Promise.resolve();
  }
  
  /**
   * Abstract attach method - must be implemented by subclasses
   */
  abstract attach(page: Page, config?: DetectorConfig): Promise<void>;
  
  /**
   * Default implementation of collect hook
   * Collects accumulated issues and clears them for the next page
   */
  collect(page: Page): Promise<DetectorResult> {
    const endTime = Date.now();
    const result: DetectorResult = {
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

    return Promise.resolve(result);
  }

  /**
   * Default implementation of cleanup hook
   */
  cleanup(): Promise<void> {
    this.issues = [];
    return Promise.resolve();
  }
}
