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
                  default: 10 
                },
                maxDepth: {
                  type: 'number',
                  description: 'Maximum crawl depth',
                  default: 2
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
                  default: 3
                },
                threshold: {
                  type: 'number',
                  description: 'Minimum reproducibility score (0-100)',
                  default: 70
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
          return this.handleScanSite(args as any);
        case 'validate_reproduction':
          return this.handleValidate(args as any);
        case 'diff_scans':
          return this.handleDiff(args as any);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  private async handleScanSite(args: {
    url: string;
    maxPages?: number;
    maxDepth?: number;
    detectors?: string[];
    bundle?: boolean;
    screenshots?: boolean;
  }) {
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
        maxDepth: args.maxDepth || 2,
        maxPages: args.maxPages || 10,
        rateLimit: 1000,
        headless: true,
        recordHar: args.bundle !== false,
        captureScreenshots: args.screenshots !== false,
      };
      
      // Run scan
      const results = await scanner.scan(config);
      
      // Create bundle if requested
      let bundlePath: string | undefined;
      if (args.bundle !== false) {
        const { createBundle } = await import('../bundler/index.js');
        bundlePath = await createBundle({
          scanResults: results,
          harPath: results.harPath,
        });
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

  private async handleValidate(args: {
    bundlePath: string;
    runs?: number;
    threshold?: number;
  }) {
    try {
      const result = await validateReproducibility({
        bundlePath: args.bundlePath,
        runs: args.runs || 3,
      });
      
      const threshold = args.threshold || 70;
      const passed = result.reproducibilityScore >= threshold;
      
      const summary = `Validation Results:\n\n` +
        `Reproducibility Score: ${result.reproducibilityScore.toFixed(1)}%\n` +
        `Threshold: ${threshold}%\n` +
        `Status: ${passed ? '✅ PASSED' : '❌ FAILED'}\n\n` +
        `Original Scan: ${result.originalScan.summary.totalIssues} issues\n` +
        `Replay Runs: ${result.summary.totalRuns} (${result.summary.successfulRuns} successful)\n` +
        `Average Issues Found: ${result.summary.averageIssuesFound.toFixed(1)}\n\n` +
        `Grade: ${result.reproducibilityScore >= 90 ? '🥇 Excellent' : 
                  result.reproducibilityScore >= 80 ? '🥈 Good' : 
                  result.reproducibilityScore >= 70 ? '🥉 Fair' : '❌ Poor'}`;
      
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

  private async handleDiff(args: {
    baselinePath: string;
    comparisonPath: string;
  }) {
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
