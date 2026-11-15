import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

it.skipIf(process.platform === 'win32')('rejects a FIFO without a writer promptly and publishes no archive', () => {
  const dir = mkdtempSync(join(tmpdir(), 'repro-fifo-test-'));
  try {
    const input = join(dir, 'synthetic-fifo');
    const output = join(dir, 'summary.zip');
    const fifo = spawnSync('/usr/bin/mkfifo', [input], { timeout: 2000, env: {} });
    expect(fifo.status).toBe(0);
    const source = readFileSync(new URL('../../src/bundler/summary.ts', import.meta.url), 'utf8');
    const admZip = pathToFileURL(createRequire(import.meta.url).resolve('adm-zip')).href;
    const compiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
    }).outputText.replace("from 'adm-zip'", `from ${JSON.stringify(admZip)}`);
    const moduleFile = join(dir, 'summary.mjs');
    writeFileSync(moduleFile, compiled);
    const code = `import { exportScanSummary } from ${JSON.stringify(pathToFileURL(moduleFile).href)};
      try { await exportScanSummary(${JSON.stringify(input)}, ${JSON.stringify(output)}); process.exitCode=2; }
      catch(error) { if(error.message !== 'Summary export failed. Use valid scan JSON up to 5 MiB and a writable, unused destination.') process.exitCode=3; }`;
    // Kill a regressed blocked open in its own process, never hang the test worker.
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
      timeout: 2000, killSignal: 'SIGKILL', env: {}, encoding: 'utf8',
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(existsSync(output)).toBe(false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}, 6000);
