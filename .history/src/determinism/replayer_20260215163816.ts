import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Scanner, type ScanResults, type ScanConfig } from '../scanner/index.js';
import { 
  DetectorRegistry,
  JavaScriptErrorsDetector,
  NetworkErrorsDetector,
  BrokenAssetsDetector,
  AccessibilityDetector,
  WebVitalsDetector,
  MixedContentDetector,
  BrokenLinksDetector,
} from '../detectors/index.js';

export interface ReplayOptions {
  harPath: string;
  url: string;
  scanner: Scanner;
  headless?: boolean;
  outputDir?: string;
}

export interface ReplayResult {
  success: boolean;
  results: ScanResults;
  errors: string[];
  missedRequests: string[];
  fallbackRequests: string[];
}

export interface ValidationOptions {
  bundlePath: string;
  runs?: number;
  outputDir?: string;
}

export interface ValidationResult {
  originalScan: ScanResults;
  replayRuns: ReplayResult[];
  reproducibilityScore: number;
  summary: {
    totalRuns: number;
    successfulRuns: number;
    averageIssuesFound: number;
    consistentIssues: number;
    inconsistentIssues: number;
  };
}

/**
 * Replay a scan using a recorded HAR file
 */
export async function replayFromHar(options: ReplayOptions): Promise<ReplayResult> {
  const errors: string[] = [];
  const missedRequests: string[] = [];
  const fallbackRequests: string[] = [];
  
  let browser: Browser | undefined;
  let context: BrowserContext | undefined;
  let page: Page | undefined;
  
  try {
    // Verify HAR file exists
    await fs.access(options.harPath);
    
    // Launch browser
    browser = await chromium.launch({ headless: options.headless ?? true });
    
    // Create context with HAR replay
    context = await browser.newContext();
    
    // Track network activity
    context.on('request', (request) => {
      // Track requests not in HAR (will fallback to network)
      const fromHar = request.serviceWorker() === null;
      if (!fromHar) {
        fallbackRequests.push(request.url());
      }
    });
    
    context.on('requestfailed', (request) => {
      errors.push(`Request failed: ${request.url()} - ${request.failure()?.errorText || 'Unknown error'}`);
    });
    
    // Route from HAR with fallback
    await context.routeFromHAR(options.harPath, {
      url: '**/*',
      notFound: 'fallback', // Fallback to network if missing
      update: false, // Replay mode (don't record)
    });
    
    page = await context.newPage();
    
    // Navigate to URL (using HAR replay)
    await page.goto(options.url, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    
    // Wait a bit for any async operations
    await page.waitForTimeout(1000);
    
    // Run scan using the scanner's detector logic
    // We need to manually run detectors since we've already navigated
    const registry = (options.scanner as any).registry as DetectorRegistry;
    const detectors = registry.getEnabled();
    
    // Attach detectors
    for (const detector of detectors) {
      await detector.attach(page, registry.getConfig(detector.id));
    }
    
    // Run scan hooks
    for (const detector of detectors) {
      if (detector.scan) {
        await detector.scan(page, registry.getConfig(detector.id));
      }
    }
    
    // Collect results
    const detectorResults = [];
    for (const detector of detectors) {
      const result = await detector.collect(page);
      detectorResults.push(result);
    }
    
    // Calculate summary
    let totalIssues = 0;
    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    
    for (const result of detectorResults) {
      for (const issue of result.issues) {
        totalIssues++;
        byCategory[issue.category] = (byCategory[issue.category] || 0) + 1;
        bySeverity[issue.severity] = (bySeverity[issue.severity] || 0) + 1;
      }
    }
    
    // Build scan results
    const scanResults: ScanResults = {
      timestamp: new Date().toISOString(),
      url: options.url,
      config: {
        url: options.url,
        headless: options.headless ?? true,
      },
      pages: [{
        url: options.url,
        depth: 0,
        detectorResults,
        summary: {
          totalIssues,
          byCategory,
          bySeverity,
        },
      }],
      summary: {
        pagesScanned: 1,
        totalIssues,
        duration: '0s',
        byCategory,
        bySeverity,
      },
      harPath: options.harPath,
    };
    
    return {
      success: errors.length === 0,
      results: scanResults,
      errors,
      missedRequests,
      fallbackRequests,
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    
    // Return empty results on failure
    return {
      success: false,
      results: {
        timestamp: new Date().toISOString(),
        url: options.url,
        config: { url: options.url, headless: options.headless ?? true },
        pages: [],
        summary: {
          pagesScanned: 0,
          totalIssues: 0,
          duration: '0s',
          byCategory: {},
          bySeverity: {},
        },
      },
      errors,
      missedRequests,
      fallbackRequests,
    };
  } finally {
    if (page) await page.close();
    if (context) await context.close();
    if (browser) await browser.close();
  }
}

/**
 * Validate reproducibility by replaying multiple times and comparing
 */
export async function validateReproducibility(options: ValidationOptions): Promise<ValidationResult> {
  const runs = options.runs ?? 3;
  
  // Extract bundle
  const bundleDir = await extractBundle(options.bundlePath, options.outputDir);
  
  // Load original scan results
  const originalScanPath = path.join(bundleDir, 'scan-results.json');
  const originalScan: ScanResults = JSON.parse(await fs.readFile(originalScanPath, 'utf-8'));
  
  // Find HAR file
  const harPath = path.join(bundleDir, 'recording.har');
  
  try {
    await fs.access(harPath);
  } catch {
    throw new Error(`HAR file not found: ${harPath}`);
  }
  
  // Create scanner with same detectors
  const registry = new DetectorRegistry();
  
  // Register all available detectors
  registry.register(new JavaScriptErrorsDetector());
  registry.register(new NetworkErrorsDetector());
  registry.register(new BrokenAssetsDetector());
  registry.register(new AccessibilityDetector());
  registry.register(new WebVitalsDetector());
  registry.register(new MixedContentDetector());
  registry.register(new BrokenLinksDetector());
  
  const scanner = new Scanner(registry);
  
  // Run multiple replays
  const replayRuns: ReplayResult[] = [];
  
  for (let i = 0; i < runs; i++) {
    console.log(`\n🔄 Replay run ${i + 1}/${runs}...`);
    
    const result = await replayFromHar({
      harPath,
      url: originalScan.url,
      scanner,
      headless: true,
      outputDir: bundleDir,
    });
    
    replayRuns.push(result);
    
    if (result.success) {
      console.log(`   ✅ Success: ${result.results.summary.totalIssues} issues found`);
    } else {
      console.log(`   ❌ Failed: ${result.errors.length} errors`);
    }
  }
  
  // Calculate reproducibility score
  const score = calculateReproducibilityScore(originalScan, replayRuns);
  
  return {
    originalScan,
    replayRuns,
    reproducibilityScore: score,
    summary: {
      totalRuns: runs,
      successfulRuns: replayRuns.filter(r => r.success).length,
      averageIssuesFound: replayRuns.reduce((sum, r) => sum + r.results.summary.totalIssues, 0) / runs,
      consistentIssues: 0, // TODO: Calculate
      inconsistentIssues: 0, // TODO: Calculate
    },
  };
}

/**
 * Calculate reproducibility score (0-100%)
 */
function calculateReproducibilityScore(original: ScanResults, replays: ReplayResult[]): number {
  const originalIssueCount = original.summary.totalIssues;
  
  if (originalIssueCount === 0) {
    // If no issues in original, check if replays also found no issues
    const noIssueReplays = replays.filter(r => r.results.summary.totalIssues === 0).length;
    return (noIssueReplays / replays.length) * 100;
  }
  
  // Calculate what percentage of original issues were reproduced in each run
  let totalScore = 0;
  
  for (const replay of replays) {
    const replayIssueCount = replay.results.summary.totalIssues;
    
    // Simple score: how close is replay count to original count
    const countDiff = Math.abs(originalIssueCount - replayIssueCount);
    const maxDiff = Math.max(originalIssueCount, replayIssueCount);
    const countScore = maxDiff > 0 ? (1 - countDiff / maxDiff) : 1;
    
    totalScore += countScore;
  }
  
  return (totalScore / replays.length) * 100;
}

/**
 * Extract bundle ZIP to temporary directory
 */
async function extractBundle(bundlePath: string, outputDir?: string): Promise<string> {
  const AdmZip = (await import('adm-zip')).default;
  
  const zip = new AdmZip(bundlePath);
  const extractDir = outputDir || path.join(path.dirname(bundlePath), 'extracted');
  
  await fs.mkdir(extractDir, { recursive: true });
  zip.extractAllTo(extractDir, true);
  
  return extractDir;
}
