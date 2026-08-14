/**
 * MCP Server Integration Tests
 * Tests the MCP server initialization and tool definitions
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ReproMcpServer, MCP_TOOLS } from '../../src/mcp/server';
import { DETECTOR_IDS } from '../../src/detectors/catalog.js';

describe('MCP Server Initialization', () => {
  it('should initialize server instance', () => {
    const server = new ReproMcpServer();
    expect(server).toBeDefined();
    expect(server).toBeInstanceOf(ReproMcpServer);
  });

  it('should have private server property initialized', () => {
    const server = new ReproMcpServer();
    expect(server).toHaveProperty('start');
    expect(typeof (server as any).start).toBe('function');
  });

  it('exposes the same tools list the handler returns', () => {
    const server = new ReproMcpServer();
    expect(server.getTools().map((t) => t.name)).toEqual(['scan_site', 'validate_reproduction', 'diff_scans']);
    expect(MCP_TOOLS).toHaveLength(3);
  });
});

describe('MCP Server Tool Definitions', () => {
  let server: ReproMcpServer;

  beforeEach(() => {
    server = new ReproMcpServer();
  });

  it('should have tool handlers set up for three tools', () => {
    expect(server).toHaveProperty('start');
    const handleScan = (server as any).handleScanSite;
    const handleValidate = (server as any).handleValidate;
    const handleDiff = (server as any).handleDiff;
    expect(handleScan).toBeDefined();
    expect(handleValidate).toBeDefined();
    expect(handleDiff).toBeDefined();
  });
});

describe('MCP Tool Parameters: scan_site', () => {
  const scanTool = MCP_TOOLS.find((t) => t.name === 'scan_site')!;
  const properties = scanTool.inputSchema.properties as Record<string, { default?: unknown }>;

  it('should require url parameter', () => {
    expect(scanTool.inputSchema.required).toEqual(['url']);
  });

  it('should have optional maxPages parameter with default 10', () => {
    expect(properties.maxPages.default).toBe(10);
  });

  it('should have optional maxDepth parameter with default 2', () => {
    expect(properties.maxDepth.default).toBe(2);
  });

  it('should document all 12 detector ids', () => {
    const description = (properties.detectors as { description?: string }).description ?? '';
    for (const id of DETECTOR_IDS) {
      expect(description).toContain(id);
    }
  });
});

describe('MCP Tool Parameters: validate_reproduction', () => {
  const tool = MCP_TOOLS.find((t) => t.name === 'validate_reproduction')!;
  const properties = tool.inputSchema.properties as Record<string, { default?: unknown }>;

  it('should require bundlePath parameter', () => {
    expect(tool.inputSchema.required).toContain('bundlePath');
  });

  it('should have optional runs parameter with default 3', () => {
    expect(properties.runs.default).toBe(3);
  });

  it('should have optional threshold parameter with default 70', () => {
    expect(properties.threshold.default).toBe(70);
  });
});

describe('MCP Tool Parameters: diff_scans', () => {
  const tool = MCP_TOOLS.find((t) => t.name === 'diff_scans')!;

  it('should require baselinePath and comparisonPath', () => {
    expect(tool.inputSchema.required).toEqual(['baselinePath', 'comparisonPath']);
  });
});

describe('MCP Server Error Handling', () => {
  let server: ReproMcpServer;

  beforeEach(() => {
    server = new ReproMcpServer();
  });

  it('rejects non-http URLs without launching a scan', async () => {
    const result = await (server as any).handleScanSite({ url: 'file:///etc/passwd' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/http\(s\)/);
  });

  it('rejects path traversal on validate', async () => {
    const result = await (server as any).handleValidate({ bundlePath: '../etc/passwd' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/escapes allowed directory/);
  });

  it('rejects path traversal on diff', async () => {
    const result = await (server as any).handleDiff({
      baselinePath: '../../secret.json',
      comparisonPath: 'scan.json',
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/escapes allowed directory/);
  });

  it('error handling methods should be async functions', () => {
    expect((server as any).handleScanSite.constructor.name).toBe('AsyncFunction');
    expect((server as any).handleValidate.constructor.name).toBe('AsyncFunction');
    expect((server as any).handleDiff.constructor.name).toBe('AsyncFunction');
  });
});
