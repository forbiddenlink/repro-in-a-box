import * as path from 'path';
import type AdmZip from 'adm-zip';

/**
 * Extract a ZIP only if every entry stays inside `destDir` (zip-slip guard).
 */
export function extractZipSafely(zip: AdmZip, destDir: string): void {
  const destResolved = path.resolve(destDir);

  for (const entry of zip.getEntries()) {
    const target = path.resolve(destResolved, entry.entryName);
    const relative = path.relative(destResolved, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`Zip slip blocked: ${entry.entryName}`);
    }
  }

  zip.extractAllTo(destResolved, true);
}

/** Summary exports intentionally have no replay evidence. */
export function assertReplayableArchive(zip: AdmZip): void {
  if (zip.getEntry('summary.json') && !zip.getEntry('scan-results.json')) {
    throw new Error('This is a summary-only export, not a replay bundle. Use the original raw bundle for validation.');
  }
}
