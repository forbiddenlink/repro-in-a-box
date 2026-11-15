/**
 * Calls the MCP tools through the protocol (in-memory client and server), the way an
 * agent does. Covers dispatch, argument validation and the success paths of
 * validate_reproduction and diff_scans. scan_site is not run here: it launches a browser.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

vi.mock('../../src/determinism/replayer.js', () => ({
  validateReproducibility: vi.fn(),
}));

import { ReproMcpServer } from '../../src/mcp/server';
import { validateReproducibility } from '../../src/determinism/replayer.js';

const issue = (message: string, selector = 'main') => ({
  type: 'js-error',
  message,
  severity: 'high',
  category: 'javascript',
  url: 'https://example.test/',
  selector,
});

const scan = (issues: ReturnType<typeof issue>[]) => ({
  timestamp: '2026-01-01T00:00:00.000Z',
  url: 'https://example.test/',
  config: {},
  pages: [
    {
      url: 'https://example.test/',
      depth: 0,
      detectorResults: [{ detectorId: 'console-errors', issues }],
      summary: { totalIssues: issues.length, byCategory: {}, bySeverity: {} },
    },
  ],
  summary: { pagesScanned: 1, totalIssues: issues.length, duration: '1s', byCategory: {}, bySeverity: {} },
});

const replay = (score: number) => ({
  reproducibilityScore: score,
  originalScan: { summary: { totalIssues: 4 } },
  summary: {
    totalRuns: 3,
    successfulRuns: 3,
    averageIssuesFound: 4,
    consistentIssues: 4,
    inconsistentIssues: 0,
  },
});

let dir: string;
let client: Client;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'repro-mcp-'));
  vi.spyOn(process, 'cwd').mockReturnValue(dir);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = new ReproMcpServer();
  await (server as any).server.connect(serverTransport);
  client = new Client({ name: 'test', version: '0.0.0' }, { capabilities: {} });
  await client.connect(clientTransport);
});

afterEach(async () => {
  await client.close();
  vi.restoreAllMocks();
  vi.mocked(validateReproducibility).mockReset();
  rmSync(dir, { recursive: true, force: true });
});

const text = (res: any): string => res.content[0].text;

describe('tools/list', () => {
  it('lists the three tools an agent can call', async () => {
    const { tools } = await client.listTools();
    expect(tools.map(t => t.name).sort()).toEqual(['diff_scans', 'scan_site', 'validate_reproduction']);
  });
});

describe('tools/call dispatch', () => {
  it('rejects an unknown tool', async () => {
    await expect(client.callTool({ name: 'nope', arguments: {} })).rejects.toThrow(/Unknown tool/);
  });

  it('rejects arguments that fail validation', async () => {
    await expect(
      client.callTool({ name: 'validate_reproduction', arguments: { bundlePath: 'b.zip', runs: 99 } })
    ).rejects.toThrow();
    await expect(client.callTool({ name: 'diff_scans', arguments: {} })).rejects.toThrow();
  });
});

describe('validate_reproduction', () => {
  it('passes at or above the default threshold and grades the score', async () => {
    vi.mocked(validateReproducibility).mockResolvedValue(replay(95) as any);
    const res: any = await client.callTool({ name: 'validate_reproduction', arguments: { bundlePath: 'b.zip' } });
    expect(res.isError).toBe(false);
    expect(text(res)).toContain('Reproducibility Score: 95.0%');
    expect(text(res)).toContain('PASSED');
    expect(text(res)).toContain('Excellent');
    expect(vi.mocked(validateReproducibility).mock.calls[0][0]).toEqual({
      bundlePath: join(dir, 'b.zip'),
      runs: 3,
    });
  });

  it('fails below a custom threshold', async () => {
    vi.mocked(validateReproducibility).mockResolvedValue(replay(75) as any);
    const res: any = await client.callTool({
      name: 'validate_reproduction',
      arguments: { bundlePath: 'b.zip', threshold: 80, runs: 5 },
    });
    expect(res.isError).toBe(true);
    expect(text(res)).toContain('FAILED');
    expect(text(res)).toContain('Threshold: 80%');
    expect(text(res)).toContain('Fair');
    expect(vi.mocked(validateReproducibility).mock.calls[0][0]).toMatchObject({ runs: 5 });
  });

  it('reports a replay failure as a tool error, not a crash', async () => {
    vi.mocked(validateReproducibility).mockRejectedValue(new Error('bundle is corrupt'));
    const res: any = await client.callTool({ name: 'validate_reproduction', arguments: { bundlePath: 'b.zip' } });
    expect(res.isError).toBe(true);
    expect(text(res)).toContain('Error validating reproduction: bundle is corrupt');
  });
});

describe('diff_scans', () => {
  it('reports added, removed and unchanged issues between two scan files', async () => {
    writeFileSync(join(dir, 'a.json'), JSON.stringify(scan([issue('kept'), issue('gone')])));
    writeFileSync(join(dir, 'b.json'), JSON.stringify(scan([issue('kept'), issue('new one')])));
    const res: any = await client.callTool({
      name: 'diff_scans',
      arguments: { baselinePath: 'a.json', comparisonPath: 'b.json' },
    });
    expect(res.isError).toBe(false);
    expect(text(res)).toContain('Match Rate: 50.0%');
    expect(text(res)).toContain('Added: 1');
    expect(text(res)).toContain('Removed: 1');
    expect(text(res)).toContain('new one');
    expect(text(res)).toContain('gone');
  });

  it('returns a tool error when a scan file is missing or not JSON', async () => {
    writeFileSync(join(dir, 'bad.json'), '{not json');
    const res: any = await client.callTool({
      name: 'diff_scans',
      arguments: { baselinePath: 'missing.json', comparisonPath: 'bad.json' },
    });
    expect(res.isError).toBe(true);
    expect(text(res)).toContain('Error comparing scans');
  });
});
