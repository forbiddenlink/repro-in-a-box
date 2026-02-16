import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import { Scanner, type ScanConfig } from '../scanner/index.js';
import { DetectorRegistry, JavaScriptErrorsDetector, NetworkErrorsDetector, BrokenAssetsDetector, AccessibilityDetector, WebVitalsDetector, MixedContentDetector, BrokenLinksDetector } from '../detectors/index.js';
import { validateReproducibility } from '../determinism/replayer.js';
import { diffScans, formatDiff } from '../determinism/diff.js';
import * as fs from 'fs/promises';

/**
 * Constants for MCP server configuration
 */
const MCP_DEFAULTS = {
  DEFAULT_MAX_PAGES: 10,
  DEFAULT_MAX_DEPTH: 2,
  DEFAULT_REPRODUCIBILITY_RUNS: 3,
  DEFAULT_REPRODUCIBILITY_THRESHOLD: 70,
  EXCELLENT_SCORE: 90,
  GOOD_SCORE: 80,
  FAIR_SCORE: 70
};

/**
 * Type-safe arguments for scan_site tool
 */
interface ScanSiteArgs {
  url: string;
  maxPages?: number;
  maxDepth?: number;
  detectors?: string[];
  bundle?: boolean;
  screenshots?: boolean;
}

/**
 * Type-safe arguments for validate_reproduction tool
 */
interface ValidateReproductionArgs {
  bundlePath: string;
  runs?: number;
  threshold?: number;
}

/**
 * Type-safe arguments for diff_scans tool
 */
interface DiffScansArgs {
  baselinePath: string;
  comparisonPath: string;
}

export class ReproMcpServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'repro-in-a-box',
        version: '2.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.setupToolHandlers();
  }

  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'scan_site',
            description: 'Scan a website for bugs and generate a reproduction bundle',
            inputSchema: {
              type: 'object',
              properties: {
                url: { 
                  type: 'string', 
                  description: 'URL to scan (e.g., https://example.com)' 
                },
                maxPages: { 
                  type: 'number', 
                  description: 'Maximum number of pages to scan',
                  default: MCP_DEFAULTS.DEFAULT_MAX_PAGES 
                },
                maxDepth: {
                  type: 'number',
                  description: 'Maximum crawl depth',
                  default: MCP_DEFAULTS.DEFAULT_MAX_DEPTH
                },
                detectors: { 
                  type: 'array', 
                  items: { type: 'string' },
                  description: 'Detector IDs to enable (js-errors, network-errors, broken-assets, accessibility, web-vitals, mixed-content, broken-links)',
                  default: ['all']
                },
                bundle: {
                  type: 'boolean',
                  description: 'Create a reproducible bundle with HAR file and screenshots',
                  default: true
                },
                screenshots: {
                  type: 'boolean',
                  description: 'Capture screenshots when issues are detected',
                  default: true
                }
              },
              required: ['url']
            }
          },
          {
            name: 'validate_reproduction',
            description: 'Validate reproducibility of a scan bundle by replaying HAR files',
            inputSchema: {
              type: 'object',
              properties: {
                bundlePath: { 
                  type: 'string',
                  description: 'Path to the ZIP bundle file'
                },
                runs: {
                  type: 'number',
                  description: 'Number of replay runs to perform',
                  default: MCP_DEFAULTS.DEFAULT_REPRODUCIBILITY_RUNS
                },
                threshold: {
                  type: 'number',
                  description: 'Minimum reproducibility score (0-100)',
                  default: MCP_DEFAULTS.DEFAULT_REPRODUCIBILITY_THRESHOLD
                }
              },
              required: ['bundlePath']
            }
          },
          {
            name: 'diff_scans',
            description: 'Compare two scan results and show differences',
            inputSchema: {
              type: 'object',
              properties: {
                baselinePath: { 
                  type: 'string',
                  description: 'Path to the baseline scan results JSON' 
                },
                comparisonPath: { 
                  type: 'string',
                  description: 'Path to the comparison scan results JSON'
                }
              },
              required: ['baselinePath', 'comparisonPath']
            }
          }
        ] as Tool[]
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'scan_site':
          return this.handleScanSite(args as unknown as ScanSiteArgs);
        case 'validate_reproduction':
          return this.handleValidate(args as unknown as ValidateReproductionArgs);
        case 'diff_scans':
          return this.handleDiff(args as unknown as DiffScansArgs);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  private async handleScanSite(args: ScanSiteArgs) {
    try {
      // Create detector registry
      const registry = new DetectorRegistry();
      
      // Register all detectors
      registry.register(new JavaScriptErrorsDetector());
      registry.register(new NetworkErrorsDetector());
      registry.register(new BrokenAssetsDetector());
      registry.register(new AccessibilityDetector());
      registry.register(new WebVitalsDetector());
      registry.register(new MixedContentDetector());
      registry.register(new BrokenLinksDetector());
      
      // Create scanner
      const scanner = new Scanner(registry);
      
      // Configure scan
      const config: ScanConfig = {
        url: args.url,
        crawler: {
          maxDepth: args.maxDepth || MCP_DEFAULTS.DEFAULT_MAX_DEPTH,
          maxPages: args.maxPages || MCP_DEFAULTS.DEFAULT_MAX_PAGES,
          rateLimitMs: 1000,
        },
        headless: true,
        recordHar: args.bundle !== false,
        screenshots: args.screenshots !== false,
        outputDir: process.cwd(),
      };
      
      // Run scan
      const results = await scanner.scan(config);
      
      // Create bundle if requested
      let bundlePath: string | undefined;
      if (args.bundle !== false) {
        const { createBundle } = await import('../bundler/index.js');
        const bundleResult = await createBundle({
          scanResults: results,
          harPath: results.harPath,
          outputDir: process.cwd(),
        });
        bundlePath = bundleResult.bundlePath;
      }
      
      // Format response
      const summary = `Scanned ${results.summary.pagesScanned} pages and found ${results.summary.totalIssues} issues.\n\n` +
        `By Category:\n${Object.entries(results.summary.byCategory).map(([cat, count]) => `  - ${cat}: ${count}`).join('\n')}\n\n` +
        `By Severity:\n${Object.entries(results.summary.bySeverity).map(([sev, count]) => `  - ${sev}: ${count}`).join('\n')}` +
        (bundlePath ? `\n\nBundle created: ${bundlePath}` : '');
      
      return {
        content: [
          {
            type: 'text',
            text: summary
          }
        ],
        isError: false
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error scanning site: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }

  private async handleValidate(args: ValidateReproductionArgs) {
    try {
      const result = await validateReproducibility({
        bundlePath: args.bundlePath,
        runs: args.runs || MCP_DEFAULTS.DEFAULT_REPRODUCIBILITY_RUNS,
      });
      
      const threshold = args.threshold || MCP_DEFAULTS.DEFAULT_REPRODUCIBILITY_THRESHOLD;
      const passed = result.reproducibilityScore >= threshold;
      
      const summary = `Validation Results:\n\n` +
        `Reproducibility Score: ${result.reproducibilityScore.toFixed(1)}%\n` +
        `Threshold: ${threshold}%\n` +
        `Status: ${passed ? '✅ PASSED' : '❌ FAILED'}\n\n` +
        `Original Scan: ${result.originalScan.summary.totalIssues} issues\n` +
        `Replay Runs: ${result.summary.totalRuns} (${result.summary.successfulRuns} successful)\n` +
        `Average Issues Found: ${result.summary.averageIssuesFound.toFixed(1)}\n\n` +
        `Grade: ${result.reproducibilityScore >= MCP_DEFAULTS.EXCELLENT_SCORE ? '🥇 Excellent' : 
                  result.reproducibilityScore >= MCP_DEFAULTS.GOOD_SCORE ? '🥈 Good' : 
                  result.reproducibilityScore >= MCP_DEFAULTS.FAIR_SCORE ? '🥉 Fair' : '❌ Poor'}`;
      
      return {
        content: [
          {
            type: 'text',
            text: summary
          }
        ],
        isError: !passed
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error validating reproduction: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }

  private async handleDiff(args: DiffScansArgs) {
    try {
      // Load scan results
      const baseline = JSON.parse(await fs.readFile(args.baselinePath, 'utf-8'));
      const comparison = JSON.parse(await fs.readFile(args.comparisonPath, 'utf-8'));
      
      // Compute diff
      const diff = diffScans(baseline, comparison);
      const formatted = formatDiff(diff);
      
      return {
        content: [
          {
            type: 'text',
            text: formatted
          }
        ],
        isError: false
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error comparing scans: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    // Server runs until stdin closes
    console.error('MCP server started on stdio');
  }
}
