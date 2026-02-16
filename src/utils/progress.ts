/**
 * Real-time progress reporting for website scanning
 */

export type ProgressFormat = 'simple' | 'detailed' | 'minimal';

export interface ProgressEvent {
  type: 'page-started' | 'page-completed' | 'issue-found' | 'detector-started' | 'detector-completed' | 'scan-completed';
  timestamp: Date;
  data: Record<string, any>;
}

export interface ProgressMetrics {
  pagesCompleted: number;
  pagesTotalEstimate?: number;
  issuesFound: number;
  detectorsCached: string[];
  timeElapsedMs: number;
  etaMs?: number;
  progressPercent?: number;
}

export class ProgressReporter {
  private startTime: Date;
  private pagesCompleted: number = 0;
  private issuesFound: number = 0;
  private pagesTotalEstimate?: number;
  private currentPageUrl?: string;
  private detectorsCached: Set<string> = new Set();
  private listeners: Map<ProgressEvent['type'], ((event: ProgressEvent) => void)[]> = new Map();
  private format: ProgressFormat;
  private enabled: boolean;
  private lastDisplayTime: number = 0;
  private displayThrottleMs: number = 500;

  constructor(options: { format?: ProgressFormat; enabled?: boolean; throttleMs?: number } = {}) {
    this.startTime = new Date();
    this.format = options.format || 'simple';
    this.enabled = options.enabled !== false;
    this.displayThrottleMs = options.throttleMs || 500;
  }

  /**
   * Register listener for progress events
   */
  on(type: ProgressEvent['type'], listener: (event: ProgressEvent) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(listener);
  }

  /**
   * Mark that page scanning started
   */
  startPage(url: string): void {
    this.currentPageUrl = url;
    this.emitEvent('page-started', { url });
    this.displayProgress();
  }

  /**
   * Mark that page scanning completed
   */
  completePage(url: string): void {
    this.pagesCompleted++;
    this.emitEvent('page-completed', { url, pagesCompleted: this.pagesCompleted });
    this.displayProgress();
  }

  /**
   * Mark that issue was detected
   */
  foundIssue(severity: string, category: string): void {
    this.issuesFound++;
    this.emitEvent('issue-found', { severity, category, totalIssues: this.issuesFound });
    this.displayProgress();
  }

  /**
   * Mark detector started
   */
  startDetector(detectorName: string): void {
    this.emitEvent('detector-started', { detector: detectorName });
  }

  /**
   * Mark detector completed
   */
  completeDetector(detectorName: string): void {
    this.detectorsCached.add(detectorName);
    this.emitEvent('detector-completed', { detector: detectorName });
  }

  /**
   * Set estimated total pages (for progress calculation)
   */
  setEstimatedPages(total: number): void {
    this.pagesTotalEstimate = total;
  }

  /**
   * Finish scanning and display final summary
   */
  complete(): void {
    this.emitEvent('scan-completed', {
      pagesCompleted: this.pagesCompleted,
      issuesFound: this.issuesFound,
      timeElapsedMs: this.getElapsedMs()
    });
    this.displayFinal();
  }

  /**
   * Get current metrics
   */
  getMetrics(): ProgressMetrics {
    const elapsedMs = this.getElapsedMs();
    const metrics: ProgressMetrics = {
      pagesCompleted: this.pagesCompleted,
      pagesTotalEstimate: this.pagesTotalEstimate,
      issuesFound: this.issuesFound,
      detectorsCached: Array.from(this.detectorsCached),
      timeElapsedMs: elapsedMs
    };

    // Calculate ETA if we have estimate
    if (this.pagesTotalEstimate && this.pagesCompleted > 0) {
      const avgTimePerPage = elapsedMs / this.pagesCompleted;
      const remainingPages = this.pagesTotalEstimate - this.pagesCompleted;
      metrics.etaMs = avgTimePerPage * remainingPages;
      metrics.progressPercent = Math.round((this.pagesCompleted / this.pagesTotalEstimate) * 100);
    }

    return metrics;
  }

  /**
   * Display current progress state
   */
  private displayProgress(): void {
    if (!this.enabled || this.format === 'minimal') {
      return;
    }

    // Throttle display updates
    const now = Date.now();
    if (now - this.lastDisplayTime < this.displayThrottleMs) {
      return;
    }
    this.lastDisplayTime = now;

    const metrics = this.getMetrics();
    const timeStr = this.formatTime(metrics.timeElapsedMs);

    if (this.format === 'simple') {
      const progressStr = metrics.progressPercent
        ? ` [${metrics.progressPercent}%]`
        : '';
      const etaStr = metrics.etaMs ? ` ETA: ${this.formatTime(metrics.etaMs)}` : '';
      process.stdout.write(
        `\r📊 Pages: ${metrics.pagesCompleted}/${metrics.pagesTotalEstimate || '?'} | Issues: ${metrics.issuesFound} | Time: ${timeStr}${progressStr}${etaStr}`
      );
    } else if (this.format === 'detailed') {
      const progressStr = metrics.progressPercent
        ? ` [${this.getProgressBar(metrics.progressPercent)} ${metrics.progressPercent}%]`
        : '';
      const etaStr = metrics.etaMs ? ` | ETA: ${this.formatTime(metrics.etaMs)}` : '';
      const currentPage = this.currentPageUrl ? ` | Now: ${this.truncateUrl(this.currentPageUrl)}` : '';
      process.stdout.write(
        `\r📊 Pages: ${metrics.pagesCompleted}/${metrics.pagesTotalEstimate || '?'}${progressStr} | Issues: ${metrics.issuesFound} | Time: ${timeStr}${etaStr}${currentPage}`
      );
    }
  }

  /**
   * Display final summary
   */
  private displayFinal(): void {
    if (!this.enabled) {
      return;
    }

    const metrics = this.getMetrics();
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Scan Complete');
    console.log(`📄 Pages Scanned: ${metrics.pagesCompleted}`);
    console.log(`🔴 Issues Found: ${metrics.issuesFound}`);
    console.log(`⏱️  Time Elapsed: ${this.formatTime(metrics.timeElapsedMs)}`);
    if (metrics.pagesCompleted > 0) {
      const avgTime = Math.round(metrics.timeElapsedMs / metrics.pagesCompleted);
      console.log(`⚡ Average per page: ${avgTime}ms`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  /**
   * Emit progress event to all listeners
   */
  private emitEvent(type: ProgressEvent['type'], data: Record<string, any>): void {
    const event: ProgressEvent = { type, timestamp: new Date(), data };
    const listeners = this.listeners.get(type);
    if (listeners) {
      listeners.forEach(listener => listener(event));
    }
  }

  /**
   * Get elapsed time in milliseconds
   */
  private getElapsedMs(): number {
    return Date.now() - this.startTime.getTime();
  }

  /**
   * Format milliseconds as human-readable time
   */
  private formatTime(ms: number): string {
    if (ms < 1000) {
      return `${Math.round(ms)}ms`;
    }
    const seconds = ms / 1000;
    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`;
    }
    const minutes = seconds / 60;
    const secs = Math.round(seconds % 60);
    return `${Math.floor(minutes)}m ${secs}s`;
  }

  /**
   * Create progress bar visual
   */
  private getProgressBar(percent: number, width: number = 20): string {
    const filled = Math.round((percent / 100) * width);
    const empty = width - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    return `[${bar}]`;
  }

  /**
   * Truncate URL for display
   */
  private truncateUrl(url: string, maxLength: number = 40): string {
    if (url.length <= maxLength) {
      return url;
    }
    return '...' + url.slice(-(maxLength - 3));
  }
}

/**
 * Create global progress reporter instance
 */
let globalProgressReporter: ProgressReporter | null = null;

export function getProgressReporter(): ProgressReporter {
  if (!globalProgressReporter) {
    globalProgressReporter = new ProgressReporter();
  }
  return globalProgressReporter;
}

export function createProgressReporter(options?: { format?: ProgressFormat; enabled?: boolean; throttleMs?: number }): ProgressReporter {
  return new ProgressReporter(options);
}

export function resetProgressReporter(): void {
  globalProgressReporter = null;
}
