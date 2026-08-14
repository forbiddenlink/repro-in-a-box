import { describe, it, expect } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import { resolveSafePath, assertHttpUrl } from '../../src/utils/safe-path.js';

describe('resolveSafePath', () => {
  const root = path.join(os.tmpdir(), 'repro-safe-path');

  it('resolves relative paths inside root', () => {
    const resolved = resolveSafePath('bundle.zip', root);
    expect(resolved).toBe(path.join(root, 'bundle.zip'));
  });

  it('allows nested relative paths', () => {
    const resolved = resolveSafePath('out/scan.json', root);
    expect(resolved).toBe(path.join(root, 'out', 'scan.json'));
  });

  it('rejects path traversal', () => {
    expect(() => resolveSafePath('../etc/passwd', root)).toThrow(/escapes allowed directory/);
    expect(() => resolveSafePath('foo/../../etc/passwd', root)).toThrow(/escapes allowed directory/);
  });

  it('rejects absolute paths outside root', () => {
    expect(() => resolveSafePath('/etc/passwd', root)).toThrow(/escapes allowed directory/);
  });
});

describe('assertHttpUrl', () => {
  it('accepts http and https', () => {
    expect(assertHttpUrl('https://example.com/path').hostname).toBe('example.com');
    expect(assertHttpUrl('http://localhost:3000').protocol).toBe('http:');
  });

  it('rejects non-http schemes', () => {
    expect(() => assertHttpUrl('file:///etc/passwd')).toThrow(/Only http\(s\)/);
    expect(() => assertHttpUrl('javascript:alert(1)')).toThrow(/Only http\(s\)/);
  });

  it('rejects invalid URLs', () => {
    expect(() => assertHttpUrl('not a url')).toThrow(/Invalid URL/);
  });
});
