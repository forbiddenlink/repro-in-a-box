import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { Scanner, type ScanConfig, type ScanResults } from '../scanner/index.js';
import { DETECTOR_IDS } from '../detectors/index.js';
import { createScanRegistry } from '../plugins/index.js';
import { validateReproducibility } from '../determinism/replayer.js';
import { diffScans, formatDiff } from '../determinism/diff.js';
import { VERSION } from '../cli/version.js';
import { assertHttpUrl, resolveSafePath } from '../utils/safe-path.js';
import * as fs from 'fs/promises';

const MCP_DEFAULTS = {
  DEFAULT_MAX_PAGES: 10,
  DEFAULT_MAX_DEPTH: 2,
  DEFAULT_REPRODUCIBILITY_RUNS: 3,
  DEFAULT_REPRODUCIBILITY_THRESHOLD: 70,
  EXCELLENT_SCORE: 90,
  GOOD_SCORE: 80,
  FAIR_SCORE: 70
};

const ScanSiteArgsSchema = z.object({
  url: z.string().min(1),
  maxPages: z.number().int().min(1).max(1000).optional(),
  maxDepth: z.number().int().min(1).max(10).optional(),
  detectors: z.array(z.string()).optional(),
  bundle: z.boolean().optional(),
  screenshots: z.boolean().optional(),
});

const ValidateReproductionArgsSchema = z.object({
  bundlePath: z.string().min(1),
  runs: z.number().int().min(1).max(20).optional(),
  threshold: z.number().min(0).max(100).optional(),
});

const DiffScansArgsSchema = z.object({
  baselinePath: z.string().min(1),
  comparisonPath: z.string().min(1),
});

type ScanSiteArgs = z.infer<typeof ScanSiteArgsSchema>;
type ValidateReproductionArgs = z.infer<typeof ValidateReproductionArgsSchema>;
type DiffScansArgs = z.infer<typeof DiffScansArgsSchema>;

const DETECTOR_LIST = DETECTOR_IDS.join(', ');

export const MCP_TOOLS: Tool[] = [
  {
    name: 'scan_site',
    description: 'Scan a website for bugs and generate a reproduction bundle. Only http(s) URLs are accepted.',
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
          description: `Detector IDs to enable, or ["all"]. Valid: ${DETECTOR_LIST}. Alias: javascript-errors → js-errors.`,
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
    description: 'Validate reproducibility of a scan bundle by replaying HAR files. bundlePath must stay under the current working directory.',
    inputSchema: {
      type: 'object',
      properties: {
        bundlePath: {
          type: 'string',
          description: 'Path to the ZIP bundle file (relative to cwd)'
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
    description: 'Compare two scan results and show differences. Paths must stay under the current working directory.',
    inputSchema: {
      type: 'object',
      properties: {
        baselinePath: {
          type: 'string',
          description: 'Path to the baseline scan results JSON (relative to cwd)'
        },
        comparisonPath: {
          type: 'string',
          description: 'Path to the comparison scan results JSON (relative to cwd)'
        }
      },
      required: ['baselinePath', 'comparisonPath']
    }
  }
];

function toolError(message: string) {
  return {
    content: [{ type: 'text' as const, text: message }],
    isError: true
  };
}

export class ReproMcpServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'repro-in-a-box',
        version: VERSION
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.setupToolHandlers();
  }

  getTools(): Tool[] {
    return MCP_TOOLS;
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return { tools: MCP_TOOLS };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'scan_site':
          return this.handleScanSite(ScanSiteArgsSchema.parse(args ?? {}));
        case 'validate_reproduction':
          return this.handleValidate(ValidateReproductionArgsSchema.parse(args ?? {}));
        case 'diff_scans':
          return this.handleDiff(DiffScansArgsSchema.parse(args ?? {}));
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  private async handleScanSite(args: ScanSiteArgs) {
    try {
      assertHttpUrl(args.url);

      const { registry, hooks } = await createScanRegistry({
        enabled: args.detectors,
      });

      const scanner = new Scanner(registry);

      const config: ScanConfig = {
        url: args.url,
        crawler: {
          maxDepth: args.maxDepth ?? MCP_DEFAULTS.DEFAULT_MAX_DEPTH,
          maxPages: args.maxPages ?? MCP_DEFAULTS.DEFAULT_MAX_PAGES,
          rateLimitMs: 1000,
        },
        headless: true,
        recordHar: args.bundle !== false,
        screenshots: args.screenshots !== false,
        outputDir: process.cwd(),
        hooks,
      };

      const results = await scanner.scan(config);

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

      const summary = `Scanned ${results.summary.pagesScanned} pages and found ${results.summary.totalIssues} issues.\n\n` +
        `Detectors: ${registry.list().join(', ')}\n\n` +
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
      return toolError(`Error scanning site: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleValidate(args: ValidateReproductionArgs) {
    try {
      const bundlePath = resolveSafePath(args.bundlePath);

      const result = await validateReproducibility({
        bundlePath,
        runs: args.runs ?? MCP_DEFAULTS.DEFAULT_REPRODUCIBILITY_RUNS,
      });

      const threshold = args.threshold ?? MCP_DEFAULTS.DEFAULT_REPRODUCIBILITY_THRESHOLD;
      const passed = result.reproducibilityScore >= threshold;

      const summary = `Validation Results:\n\n` +
        `Reproducibility Score: ${result.reproducibilityScore.toFixed(1)}%\n` +
        `Threshold: ${threshold}%\n` +
        `Status: ${passed ? '✅ PASSED' : '❌ FAILED'}\n\n` +
        `Original Scan: ${result.originalScan.summary.totalIssues} issues\n` +
        `Replay Runs: ${result.summary.totalRuns} (${result.summary.successfulRuns} successful)\n` +
        `Average Issues Found: ${result.summary.averageIssuesFound.toFixed(1)}\n` +
        `Consistent Issues: ${result.summary.consistentIssues}\n` +
        `Inconsistent Issues: ${result.summary.inconsistentIssues}\n\n` +
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
      return toolError(`Error validating reproduction: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleDiff(args: DiffScansArgs) {
    try {
      const baselinePath = resolveSafePath(args.baselinePath);
      const comparisonPath = resolveSafePath(args.comparisonPath);

      const baseline = JSON.parse(await fs.readFile(baselinePath, 'utf-8')) as ScanResults;
      const comparison = JSON.parse(await fs.readFile(comparisonPath, 'utf-8')) as ScanResults;

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
      return toolError(`Error comparing scans: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    console.error('MCP server started on stdio');
  }
}
