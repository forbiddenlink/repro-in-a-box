/** Aggregate-only export. Never follows artifact paths or copies arbitrary text. */
import { constants } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import AdmZip from 'adm-zip';

export const MAX_SUMMARY_INPUT_BYTES = 5 * 1024 * 1024;
const SEVERITIES = ['critical', 'error', 'warning', 'info'] as const;
const CATEGORIES = ['javascript', 'network', 'assets', 'accessibility', 'performance', 'security', 'links', 'console', 'seo', 'custom'] as const;
export const SUMMARY_NOTICE = 'Summary only. No replay data included. Review before sharing. Original artifacts remain unchanged and may contain sensitive data.';

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid scan summary');
  return value as Record<string, unknown>;
}
function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('Invalid summary count');
  return value;
}
function bucketCounts(value: unknown, allowed: readonly string[]): Record<string, number> {
  const result: Record<string, number> = Object.fromEntries([...allowed, 'other'].map(key => [key, 0]));
  for (const [key, valueCount] of Object.entries(record(value))) {
    const bucket = allowed.includes(key) ? key : 'other';
    result[bucket] = count(result[bucket] + count(valueCount));
  }
  return result;
}
export function buildScanSummary(value: unknown) {
  const scan = record(value);
  if (scan.schemaVersion !== undefined && scan.schemaVersion !== 1) throw new Error('Unsupported scan schema');
  if (!Array.isArray(scan.pages)) throw new Error('Invalid scan results');
  const summary = record(scan.summary);
  return {
    schemaVersion: 1,
    kind: 'repro-summary',
    replayAvailable: false,
    pagesScanned: count(summary.pagesScanned),
    totalIssues: count(summary.totalIssues),
    bySeverity: bucketCounts(summary.bySeverity, SEVERITIES),
    byCategory: bucketCounts(summary.byCategory, CATEGORIES),
    omissions: ['urls', 'timestamps', 'paths', 'messages', 'headers', 'bodies', 'screenshots', 'har', 'reproductionScripts'],
  };
}
export function createSummaryArchive(value: unknown): Buffer {
  const summary = buildScanSummary(value);
  const zip = new AdmZip();
  zip.addFile('summary.json', Buffer.from(JSON.stringify(summary, null, 2) + '\n'));
  zip.addFile('README.md', Buffer.from('# Repro summary export\n\n' + SUMMARY_NOTICE + '\n\nContains aggregate counts only. This is not a replay bundle and is not a guarantee of anonymity or suitability for publication.\n'));
  // Stable archive metadata; never copy source timestamps or filenames.
  for (const entry of zip.getEntries()) entry.header.time = new Date(1980, 0, 1);
  return zip.toBuffer();
}
async function writeScanSummary(input: string, output: string): Promise<void> {
  // Avoid blocking on a FIFO before descriptor-based regular-file validation.
  // O_NOFOLLOW still rejects symlinks; fstat validates the opened object, not a racy path.
  const source = await fs.open(input, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  let value: unknown;
  try {
    const stat = await source.stat();
    if (!stat.isFile() || stat.size > MAX_SUMMARY_INPUT_BYTES) throw new Error('Input must be a scan JSON file no larger than 5 MiB');
    const bytes = Buffer.alloc(MAX_SUMMARY_INPUT_BYTES + 1);
    let used = 0;
    while (used < bytes.length) {
      const { bytesRead } = await source.read(bytes, used, bytes.length - used, null);
      if (!bytesRead) break;
      used += bytesRead;
    }
    if (used > MAX_SUMMARY_INPUT_BYTES) throw new Error('Input exceeds 5 MiB');
    try { value = JSON.parse(bytes.subarray(0, used).toString('utf8')); }
    catch { throw new Error('Invalid scan JSON'); }
  } finally { await source.close(); }
  const archive = createSummaryArchive(value);
  const destination = path.resolve(output);
  const temporary = await fs.mkdtemp(path.join(path.dirname(destination), '.repro-summary-'));
  try {
    const staged = path.join(temporary, 'summary.zip');
    await fs.writeFile(staged, archive, { flag: 'wx', mode: 0o600 });
    // Atomic publication with no overwrite, including existing symlinks.
    await fs.link(staged, destination);
  } finally { await fs.rm(temporary, { recursive: true, force: true }); }
}

/** Keep filesystem error paths and source text out of the public error surface. */
export async function exportScanSummary(input: string, output: string): Promise<void> {
  try { await writeScanSummary(input, output); }
  catch { throw new Error('Summary export failed. Use valid scan JSON up to 5 MiB and a writable, unused destination.'); }
}
