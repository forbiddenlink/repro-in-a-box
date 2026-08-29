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
