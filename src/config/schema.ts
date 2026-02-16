import { z } from 'zod';

/**
 * Configuration schema for Repro-in-a-Box
 * Supports .reprorc.json, .reprorc.js, or via CLI flags
 */

export const ConfigSchema = z.object({
  // Detector configuration
  detectors: z.object({
    enabled: z.array(z.enum([
      'javascript-errors',
      'network-errors',
      'broken-assets',
      'accessibility',
      'web-vitals',
      'mixed-content',
      'broken-links'
    ])).optional().describe('List of detectors to enable (default: all)'),
    disabled: z.array(z.string()).optional().describe('List of detectors to disable'),
  }).optional(),

  // Crawler configuration
  crawler: z.object({
    maxDepth: z.number().int().min(1).max(10).optional()
      .describe('Maximum crawl depth (default: 3)'),
    maxPages: z.number().int().min(1).max(1000).optional()
      .describe('Maximum pages to scan (default: 100)'),
    rateLimit: z.number().int().min(0).max(10000).optional()
      .describe('Delay between requests in ms (default: 100)'),
    sameDomain: z.boolean().optional()
      .describe('Only crawl same domain (default: true)'),
    followRedirects: z.boolean().optional()
      .describe('Follow HTTP redirects (default: true)'),
  }).optional(),

  // Browser configuration
  browser: z.object({
    headless: z.boolean().optional()
      .describe('Run browser in headless mode (default: true)'),
    slowMo: z.number().int().min(0).max(5000).optional()
      .describe('Slow down operations by ms (default: 0)'),
    timeout: z.number().int().min(1000).max(120000).optional()
      .describe('Page load timeout in ms (default: 30000)'),
    userAgent: z.string().optional()
      .describe('Custom user agent string'),
  }).optional(),

  // Output configuration
  output: z.object({
    format: z.enum(['json', 'text', 'csv', 'html']).optional()
      .describe('Output format (default: text)'),
    path: z.string().optional()
      .describe('Output directory path (default: ./repro-results)'),
    verbose: z.boolean().optional()
      .describe('Enable verbose logging (default: false)'),
    quiet: z.boolean().optional()
      .describe('Suppress all output except errors (default: false)'),
  }).optional(),

  // Validation thresholds
  thresholds: z.object({
    minReproducibility: z.number().min(0).max(100).optional()
      .describe('Minimum reproducibility score to pass (default: 70)'),
    maxIssues: z.number().int().min(0).optional()
      .describe('Maximum issues before failing (default: null = no limit)'),
    failOn: z.array(z.enum(['error', 'warning', 'info'])).optional()
      .describe('Issue severities that cause failure (default: [error])'),
  }).optional(),

  // Bundler configuration
  bundle: z.object({
    enabled: z.boolean().optional()
      .describe('Create reproducible bundles (default: true when --bundle flag)'),
    includeScreenshots: z.boolean().optional()
      .describe('Include screenshots in bundle (default: true)'),
    includeHar: z.boolean().optional()
      .describe('Include HAR files in bundle (default: true)'),
    compression: z.enum(['none', 'fast', 'best']).optional()
      .describe('ZIP compression level (default: fast)'),
  }).optional(),
}).strict();

export type ReproConfig = z.infer<typeof ConfigSchema>;

/**
 * Full config type with all nested objects required
 * (returned by mergeConfigs after applying DEFAULT_CONFIG)
 */
export type FullReproConfig = {
  detectors: NonNullable<ReproConfig['detectors']>;
  crawler: NonNullable<ReproConfig['crawler']>;
  browser: NonNullable<ReproConfig['browser']>;
  output: NonNullable<ReproConfig['output']>;
  thresholds: NonNullable<ReproConfig['thresholds']>;
  bundle: NonNullable<ReproConfig['bundle']>;
};

/**
 * Default configuration values
 * Contains all required nested objects with sensible defaults
 */
export const DEFAULT_CONFIG: FullReproConfig = {
  detectors: {
    enabled: [],
    disabled: [],
  },
  crawler: {
    maxDepth: 3,
    maxPages: 100,
    rateLimit: 100,
    sameDomain: true,
    followRedirects: true,
  },
  browser: {
    headless: true,
    slowMo: 0,
    timeout: 30000,
  },
  output: {
    format: 'text',
    path: './repro-results',
    verbose: false,
    quiet: false,
  },
  thresholds: {
    minReproducibility: 70,
    failOn: ['error'],
  },
  bundle: {
    enabled: false,
    includeScreenshots: true,
    includeHar: true,
    compression: 'fast',
  },
};

/**
 * Merge configs with priority: CLI flags > config file > defaults
 * Always returns a complete config with all nested objects populated
 */
export function mergeConfigs(...configs: Partial<ReproConfig>[]): FullReproConfig {
  const merged = { ...DEFAULT_CONFIG };
  
  for (const config of configs) {
    if (config.detectors) {
      merged.detectors = { ...merged.detectors, ...config.detectors };
    }
    if (config.crawler) {
      merged.crawler = { ...merged.crawler, ...config.crawler };
    }
    if (config.browser) {
      merged.browser = { ...merged.browser, ...config.browser };
    }
    if (config.output) {
      merged.output = { ...merged.output, ...config.output };
    }
    if (config.thresholds) {
      merged.thresholds = { ...merged.thresholds, ...config.thresholds };
    }
    if (config.bundle) {
      merged.bundle = { ...merged.bundle, ...config.bundle };
    }
  }
  
  return merged;
}
