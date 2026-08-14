import * as path from 'path';

/**
 * Resolve `userPath` and reject anything that escapes `root`.
 * Relative paths are resolved against `root` (default: cwd).
 */
export function resolveSafePath(userPath: string, root: string = process.cwd()): string {
  if (!userPath || typeof userPath !== 'string') {
    throw new Error('Path is required');
  }

  const rootResolved = path.resolve(root);
  const resolved = path.resolve(rootResolved, userPath);
  const relative = path.relative(rootResolved, resolved);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Path escapes allowed directory (${rootResolved}): ${userPath}`);
  }

  return resolved;
}

const HTTP_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Parse and require an http(s) URL. file:, javascript:, etc. are rejected.
 */
export function assertHttpUrl(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`Invalid URL: ${raw}`);
  }

  if (!HTTP_PROTOCOLS.has(parsed.protocol)) {
    throw new Error(`Only http(s) URLs are allowed, got ${parsed.protocol}`);
  }

  return parsed;
}
