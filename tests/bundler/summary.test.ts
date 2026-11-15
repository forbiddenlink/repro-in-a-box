import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import AdmZip from 'adm-zip';
import { buildScanSummary, createSummaryArchive, exportScanSummary, MAX_SUMMARY_INPUT_BYTES } from '../../src/bundler/summary.js';

const dirs: string[] = [];
async function directory() { const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'repro-summary-test-')); dirs.push(dir); return dir; }
afterEach(async () => { for (const dir of dirs.splice(0)) await fs.rm(dir, { recursive: true, force: true }); });
const fixture = () => ({ pages: [], summary: { pagesScanned: 0, totalIssues: 2, bySeverity: { warning: 2 }, byCategory: { custom: 2 } } });

describe('aggregate-only summary export', () => {
  it('copies only fixed schema and validated aggregate counts', () => {
    const input = fixture();
    const output = buildScanSummary(input);
    expect(output.kind).toBe('repro-summary');
    expect(output.replayAvailable).toBe(false);
    expect(output.bySeverity.warning).toBe(2);
    expect(Object.keys(output)).toEqual(['schemaVersion', 'kind', 'replayAvailable', 'pagesScanned', 'totalIssues', 'bySeverity', 'byCategory', 'omissions']);
  });
  it('excludes synthetic canaries in every sensitive field, unknown key and archive member', () => {
    const canaries = Array.from({ length: 14 }, (_, i) => `SYNTHETIC_CANARY_${i}_ONLY`);
    const input = { ...fixture(), url: `https://${canaries[0]}:${canaries[1]}@example.test/${canaries[2]}?q=${canaries[3]}#${canaries[4]}`,
      timestamp: canaries[5], harPath: canaries[6], screenshotPath: canaries[7],
      pages: [{ url: canaries[8], headers: { Authorization: canaries[9], 'sEt-CoOkIe': canaries[10] }, cookies: [canaries[11]], postData: canaries[12], response: canaries[13], screenshotPath: '/not-a-file', detectorResults: [{ message: canaries.join(' '), stack: canaries, html: canaries, attachment: canaries }]}],
      extensions: { nested: canaries },
      summary: { ...fixture().summary, byCategory: { [canaries[0]]: 2 }, bySeverity: { [canaries[1]]: 2 } },
    };
    const original = JSON.stringify(input);
    const zip = new AdmZip(createSummaryArchive(input));
    expect(zip.getEntries().map(entry => entry.entryName).sort()).toEqual(['README.md', 'summary.json']);
    const allOutput = zip.getEntries().map(entry => entry.entryName + entry.getData().toString()).join('');
    for (const canary of canaries) expect(allOutput).not.toContain(canary);
    expect(JSON.parse(zip.readAsText('summary.json')).byCategory.other).toBe(2);
    expect(zip.readAsText('README.md')).toContain('No replay data included');
    expect(JSON.stringify(input)).toBe(original);
    expect(createSummaryArchive(input)).toEqual(createSummaryArchive(input));
  });
  it.each([-1, NaN, Infinity, 1.5, '2', Number.MAX_SAFE_INTEGER + 1])('rejects invalid counts: %s', value => {
    expect(() => buildScanSummary({ ...fixture(), summary: { ...fixture().summary, totalIssues: value } })).toThrow();
  });
  it('rejects unsupported schemas and aggregate overflow', () => {
    expect(() => buildScanSummary({ ...fixture(), schemaVersion: 2 })).toThrow('Unsupported');
    expect(() => buildScanSummary({ ...fixture(), summary: { ...fixture().summary, byCategory: { unknownA: Number.MAX_SAFE_INTEGER, unknownB: 1 } } })).toThrow();
  });
  it('exports without following embedded artifact paths and preserves input', async () => {
    const dir = await directory();
    const input = path.join(dir, 'input.json');
    const raw = JSON.stringify({ ...fixture(), harPath: '/nonexistent/synthetic.har', pages: [{ screenshotPath: '/nonexistent/synthetic.png' }] });
    await fs.writeFile(input, raw);
    const output = path.join(dir, 'summary.zip');
    await exportScanSummary(input, output);
    expect(await fs.readFile(input, 'utf8')).toBe(raw);
    expect(new AdmZip(output).getEntries()).toHaveLength(2);
    expect((await fs.readdir(dir)).sort()).toEqual(['input.json', 'summary.zip']);
  });
  it('refuses overwrite and destination symlinks without modifying either file', async () => {
    const dir = await directory(); const input = path.join(dir, 'input.json'); const output = path.join(dir, 'existing.zip');
    await fs.writeFile(input, JSON.stringify(fixture())); await fs.writeFile(output, 'KEEP');
    await expect(exportScanSummary(input, output)).rejects.toThrow();
    expect(await fs.readFile(output, 'utf8')).toBe('KEEP');
    const link = path.join(dir, 'link.zip'); await fs.symlink(output, link);
    await expect(exportScanSummary(input, link)).rejects.toThrow();
    expect(await fs.readFile(output, 'utf8')).toBe('KEEP');
    expect((await fs.readdir(dir)).filter(name => name.startsWith('.repro-summary-'))).toEqual([]);
  });
  it('rejects malformed, oversized and symlink inputs without creating an archive', async () => {
    const dir = await directory(); const input = path.join(dir, 'input.json'); const output = path.join(dir, 'summary.zip');
    await fs.writeFile(input, '{SYNTHETIC_BAD_JSON');
    await expect(exportScanSummary(input, output)).rejects.toThrow('Summary export failed');
    await fs.truncate(input, MAX_SUMMARY_INPUT_BYTES + 1);
    await expect(exportScanSummary(input, output)).rejects.toThrow('5 MiB');
    const link = path.join(dir, 'source-link'); await fs.symlink(input, link);
    await expect(exportScanSummary(link, output)).rejects.toThrow();
    await expect(fs.stat(output)).rejects.toThrow();
  });
});

describe('replay boundary', () => {
  it('rejects summary archives before extraction without affecting raw bundles', async () => {
    const { assertReplayableArchive } = await import('../../src/utils/zip.js');
    expect(() => assertReplayableArchive(new AdmZip(createSummaryArchive(fixture())))).toThrow('summary-only');
    const raw = new AdmZip(); raw.addFile('scan-results.json', Buffer.from('{}')); raw.addFile('recording.har', Buffer.from('synthetic'));
    expect(() => assertReplayableArchive(raw)).not.toThrow();
  });
});

it('does not expose source filenames in API errors', async () => {
  const dir = await directory();
  try { await exportScanSummary(path.join(dir, 'SYNTHETIC_PRIVATE_FILENAME'), path.join(dir, 'summary.zip')); }
  catch (error) { expect(String(error)).not.toContain('SYNTHETIC_PRIVATE_FILENAME'); expect(String(error)).not.toContain(dir); return; }
  throw new Error('Expected failure');
});
