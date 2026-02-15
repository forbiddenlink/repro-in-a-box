/**
 * MCP Server Integration Tests
 * Tests the MCP server initialization
 */
import { describe, it, expect } from 'vitest';
import { ReproMcpServer } from '../../src/mcp/server';

describe('MCP Server', () => {
  it('should initialize server instance', () => {
    const server = new ReproMcpServer();
    expect(server).toBeDefined();
    expect(server).toBeInstanceOf(ReproMcpServer);
  });

  it('should have server property', () => {
    const server = new ReproMcpServer();
    expect(server).toHaveProperty('server');
  });
});

