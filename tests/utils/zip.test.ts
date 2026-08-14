import { describe, it, expect } from 'vitest';
import AdmZip from 'adm-zip';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { extractZipSafely } from '../../src/utils/zip.js';

describe('extractZipSafely', () => {
  it('extracts entries that stay inside dest', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repro-zip-ok-'));
    const zip = new AdmZip();
    zip.addFile('scan-results.json', Buffer.from('{"ok":true}'));

    extractZipSafely(zip, dir);

    expect(fs.existsSync(path.join(dir, 'scan-results.json'))).toBe(true);
  });

  it('blocks zip-slip paths', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repro-zip-bad-'));
    const zip = new AdmZip();
    zip.addFile('evil.txt', Buffer.from('nope'));
    zip.getEntries()[0].entryName = '../evil.txt';

    expect(() => extractZipSafely(zip, dir)).toThrow(/Zip slip blocked/);
  });
});
