import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import AdmZip from 'adm-zip';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { createBundle } from '../src/bundler/index.js';
import type { ScanResults } from '../src/scanner/index.js';

function makeResults(screenshotPath?: string): ScanResults {
  return {
    timestamp: '2026-10-30T12:00:00.000Z',
    url: 'https://example.com',
    config: { url: 'https://example.com' } as ScanResults['config'],
    pages: [
      {
        url: 'https://example.com',
        depth: 0,
        detectorResults: [],
        summary: { totalIssues: 0, byCategory: {}, bySeverity: {} },
        screenshotPath,
      },
    ],
    summary: { pagesScanned: 1, totalIssues: 0, duration: '1s', byCategory: {}, bySeverity: {} },
  };
}

async function readReadme(bundlePath: string): Promise<string> {
  return new AdmZip(bundlePath).readAsText('README.md');
}

describe('bundle README privacy note', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'repro-bundle-'));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('warns about the HAR when the bundle contains one', async () => {
    const harPath = path.join(dir, 'recording.har');
    await fs.writeFile(harPath, '{"log":{"entries":[]}}');
    const { bundlePath } = await createBundle({ scanResults: makeResults(), outputDir: dir, harPath });
    const readme = await readReadme(bundlePath);

    expect(readme).toContain('## Before you share this bundle');
    expect(readme).toContain('does not upload');
    expect(readme).toMatch(/recording\.har.*Authorization/s);
  });

  it('does not mention a HAR or screenshots the bundle does not hold', async () => {
    const { bundlePath } = await createBundle({ scanResults: makeResults(), outputDir: dir });
    const readme = await readReadme(bundlePath);
    const section = readme.slice(readme.indexOf('## Before you share this bundle'));

    expect(section).toContain('scan-results.json');
    expect(section).not.toContain('recording.har');
    expect(section).not.toContain('screenshots/');
  });

  it('names the screenshots when the bundle holds them', async () => {
    const shot = path.join(dir, '1-home.png');
    await fs.writeFile(shot, 'png');
    const { bundlePath } = await createBundle({ scanResults: makeResults(shot), outputDir: dir });
    const readme = await readReadme(bundlePath);
    const section = readme.slice(readme.indexOf('## Before you share this bundle'));

    expect(section).toContain('screenshots/');
  });
});
