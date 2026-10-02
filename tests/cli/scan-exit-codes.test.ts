import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'http';
import type { AddressInfo } from 'net';
import { spawn } from 'child_process';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { countAtOrAbove } from '../../src/cli/commands/scan.js';

const ROOT = resolve(__dirname, '../..');
const TSX = join(ROOT, 'node_modules/.bin/tsx');

// Page with a known issue (missing title/lang/meta etc.), so every scan finds something.
const PAGE = '<!doctype html><html><body><img src="/missing.png"><p>hi</p></body></html>';

let server: Server;
let baseUrl: string;
let outDir: string;

// Must be async: the fixture server lives in this process, so a blocking spawn would deadlock it.
function run(args: string[]): Promise<number | null> {
  return new Promise((resolveRun) => {
    const child = spawn(TSX, ['src/cli/index.ts', 'scan', ...args], { cwd: ROOT, stdio: 'ignore' });
    const timer = setTimeout(() => child.kill('SIGKILL'), 90_000);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolveRun(code);
    });
  });
}

async function scan(...extra: string[]): Promise<{ status: number | null; totalIssues: number }> {
  const jsonPath = join(outDir, `r-${Math.random().toString(36).slice(2)}.json`);
  const status = await run([baseUrl, '--max-pages', '1', '--max-depth', '0', '--format', 'json', '--output', jsonPath, ...extra]);
  let totalIssues = -1;
  try {
    totalIssues = JSON.parse(readFileSync(jsonPath, 'utf8')).summary.totalIssues;
  } catch {
    // invalid-argument runs never write results
  }
  return { status, totalIssues };
}

describe('repro scan exit codes (--fail-on)', () => {
  beforeAll(async () => {
    outDir = mkdtempSync(join(tmpdir(), 'repro-exit-'));
    server = createServer((req, res) => {
      if (req.url === '/') {
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end(PAGE);
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
  });

  afterAll(() => {
    server.close();
    rmSync(outDir, { recursive: true, force: true });
  });

  it('exits 0 by default even when issues are found', async () => {
    const { status, totalIssues } = await scan();
    expect(totalIssues).toBeGreaterThan(0);
    expect(status).toBe(0);
  }, 120_000);

  it('exits 0 with --fail-on none', async () => {
    expect((await scan('--fail-on', 'none')).status).toBe(0);
  }, 120_000);

  it('exits 1 with --fail-on info when any issue exists', async () => {
    const { status, totalIssues } = await scan('--fail-on', 'info');
    expect(totalIssues).toBeGreaterThan(0);
    expect(status).toBe(1);
  }, 120_000);

  it('exits 1 with --fail-on critical when a critical issue exists', async () => {
    expect((await scan('--fail-on', 'critical')).status).toBe(1);
  }, 120_000);

  it('rejects an unknown --fail-on value with a non-zero exit', async () => {
    const { status } = await scan('--fail-on', 'bogus');
    expect(status).not.toBe(0);
    expect(status).not.toBeNull();
  }, 60_000);
});

describe('countAtOrAbove', () => {
  const by = { info: 7, warning: 11, error: 4, critical: 1 };
  it.each([
    ['none', 0],
    ['info', 23],
    ['warning', 16],
    ['error', 5],
    ['critical', 1],
  ] as const)('%s -> %i', (level, expected) => {
    expect(countAtOrAbove(by, level)).toBe(expected);
  });
});
