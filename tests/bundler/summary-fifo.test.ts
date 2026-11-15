import { expect, it } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

it.skipIf(process.platform === 'win32')('rejects a FIFO without a writer promptly and publishes no archive', () => {
  const dir = mkdtempSync(join(tmpdir(), 'repro-fifo-test-'));
  try {
    const input = join(dir, 'synthetic-fifo');
    const output = join(dir, 'summary.zip');
    const fifo = spawnSync('/usr/bin/mkfifo', [input], { timeout: 2000, env: {} });
    expect(fifo.status).toBe(0);
    // Load the TypeScript source through tsx in the child process; no compiler API needed.
    const summaryUrl = pathToFileURL(fileURLToPath(new URL('../../src/bundler/summary.ts', import.meta.url))).href;
    const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
    const code = `import { exportScanSummary } from ${JSON.stringify(summaryUrl)};
      try { await exportScanSummary(${JSON.stringify(input)}, ${JSON.stringify(output)}); process.exitCode=2; }
      catch(error) { if(error.message !== 'Summary export failed. Use valid scan JSON up to 5 MiB and a writable, unused destination.') process.exitCode=3; }`;
    // Kill a regressed blocked open in its own process, never hang the test worker.
    const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', code], {
      cwd: repoRoot, timeout: 2000, killSignal: 'SIGKILL', env: {}, encoding: 'utf8',
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(existsSync(output)).toBe(false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}, 6000);
