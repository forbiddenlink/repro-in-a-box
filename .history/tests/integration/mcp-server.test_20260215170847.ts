/**
 * MCP Server Integration Tests
 * Tests the MCP tool implementations
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { ReproMcpServer } from '../../src/mcp/server';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

describe('MCP Server Tools', () => {
  let server: ReproMcpServer;

  beforeAll(() => {
    server = new ReproMcpServer();
  });

  it('should list all available tools', async () => {
    const request = ListToolsRequestSchema.parse({
      method: 'tools/list',
    });

    const response = await server.handleListTools(request);

    expect(response.tools).toBeDefined();
    expect(response.tools.length).toBe(3);
    
    const toolNames = response.tools.map(t => t.name);
    expect(toolNames).toContain('scan_site');
    expect(toolNames).toContain('validate_reproduction');
    expect(toolNames).toContain('diff_scans');
  });

  it('should describe scan_site tool correctly', async () => {
    const request = ListToolsRequestSchema.parse({
      method: 'tools/list',
    });

    const response = await server.handleListTools(request);
    const scanTool = response.tools.find(t => t.name === 'scan_site');

    expect(scanTool).toBeDefined();
    expect(scanTool?.description).toContain('Scan a website');
    expect(scanTool?.inputSchema).toBeDefined();
    expect(scanTool?.inputSchema.properties?.url).toBeDefined();
  });

  it('should validate scan_site parameters', async () => {
    const request = CallToolRequestSchema.parse({
      method: 'tools/call',
      params: {
        name: 'scan_site',
        arguments: {
          url: 'not-a-url', // Invalid URL
        },
      },
    });

    const response = await server.handleCallTool(request);

    expect(response.content).toBeDefined();
    expect(response.content[0]).toBeDefined();
    expect(response.isError).toBe(true);
  });

  it('should scan a website successfully', async () => {
    const request = CallToolRequestSchema.parse({
      method: 'tools/call',
      params: {
        name: 'scan_site',
        arguments: {
          url: 'https://example.com',
          maxDepth: 1,
          maxPages: 1,
        },
      },
    });

    const response = await server.handleCallTool(request);

    expect(response.content).toBeDefined();
    expect(response.content[0].type).toBe('text');
    
    const content = JSON.parse(response.content[0].text);
    expect(content.url).toBe('https://example.com');
    expect(content.pages).toBeDefined();
    expect(content.summary).toBeDefined();
  }, 30000); // 30s timeout

  it('should validate validate_reproduction tool', async () => {
    const request = CallToolRequestSchema.parse({
      method: 'tools/call',
      params: {
        name: 'validate_reproduction',
        arguments: {
          harPath: '/nonexistent/path.har',
        },
      },
    });

    const response = await server.handleCallTool(request);

    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain('not found');
  });

  it('should validate diff_scans tool', async () => {
    const request = CallToolRequestSchema.parse({
      method: 'tools/call',
      params: {
        name: 'diff_scans',
        arguments: {
          originalPath: '/nonexistent/scan1.json',
          replayPath: '/nonexistent/scan2.json',
        },
      },
    });

    const response = await server.handleCallTool(request);

    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain('not found');
  });

  it('should reject unknown tool names', async () => {
    const request = CallToolRequestSchema.parse({
      method: 'tools/call',
      params: {
        name: 'nonexistent_tool',
        arguments: {},
      },
    });

    const response = await server.handleCallTool(request);

    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain('Unknown tool');
  });

  it('should handle missing required parameters', async () => {
    const request = CallToolRequestSchema.parse({
      method: 'tools/call',
      params: {
        name: 'scan_site',
        arguments: {}, // Missing required 'url' parameter
      },
    });

    const response = await server.handleCallTool(request);

    expect(response.isError).toBe(true);
  });
});
