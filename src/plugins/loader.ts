import * as fs from 'fs/promises';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { DetectorRegistry } from '../detectors/registry.js';
import {
  canonicalDetectorId,
  registerDetectors,
} from '../detectors/catalog.js';
import { resolveSafePath } from '../utils/safe-path.js';
import { PluginManifestSchema } from './types.js';
import type {
  Detector,
} from '../detectors/base.js';
import type {
  LoadedPlugin,
  PluginHooks,
  PluginLoadOptions,
  PluginScanContext,
  ReproPlugin,
} from './types.js';
import type { ScanResults } from '../scanner/index.js';

const PLUGIN_NAME_RE = /(?:^|\/)repro-plugin-[a-z0-9-_]+$/i;

export interface ScanRegistryResult {
  registry: DetectorRegistry;
  plugins: LoadedPlugin[];
  hooks: PluginHooks;
}

function isDetector(value: unknown): value is Detector {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const d = value as Partial<Detector>;
  return typeof d.id === 'string'
    && d.id.length > 0
    && typeof d.name === 'string'
    && typeof d.attach === 'function'
    && typeof d.collect === 'function';
}

function instantiateIfClass(value: unknown): unknown {
  if (typeof value === 'function') {
    try {
      return new (value as new () => unknown)();
    } catch {
      return value;
    }
  }
  return value;
}

function normalizePlugin(mod: unknown, fallbackName: string, source: string): LoadedPlugin {
  const record = (mod && typeof mod === 'object') ? mod as Record<string, unknown> : {};

  let candidate: unknown = record.default ?? mod;
  if (candidate && typeof candidate === 'object' && 'createPlugin' in (candidate as object)
    && typeof (candidate as { createPlugin: unknown }).createPlugin === 'function') {
    candidate = (candidate as { createPlugin: () => unknown }).createPlugin();
  }

  candidate = instantiateIfClass(candidate);

  if (isDetector(candidate)) {
    return {
      name: fallbackName,
      source,
      detectors: [candidate],
    };
  }

  const plugin = candidate as Partial<ReproPlugin>;
  const parsed = PluginManifestSchema.safeParse({
    name: plugin.name ?? fallbackName,
    version: plugin.version,
  });
  if (!parsed.success) {
    throw new Error(`Invalid plugin manifest at ${source}: ${parsed.error.message}`);
  }

  const detectorsRaw = plugin.detectors ?? [];
  const detectors = detectorsRaw.map((d, i) => {
    const instance = instantiateIfClass(d);
    if (!isDetector(instance)) {
      throw new Error(`Plugin '${parsed.data.name}' detectors[${i}] is not a Detector`);
    }
    return instance;
  });

  return {
    name: parsed.data.name,
    version: parsed.data.version,
    source,
    detectors,
    hooks: plugin.hooks,
  };
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolvePackageEntry(packageName: string, cwd: string): Promise<string> {
  const pkgDir = path.join(cwd, 'node_modules', packageName);
  const pkgJsonPath = path.join(pkgDir, 'package.json');
  if (!(await fileExists(pkgJsonPath))) {
    throw new Error(`Plugin package not installed: ${packageName} (looked in ${pkgDir})`);
  }
  const raw = JSON.parse(await fs.readFile(pkgJsonPath, 'utf-8')) as {
    main?: string;
    module?: string;
    exports?: unknown;
  };
  const entry = raw.module || raw.main || 'index.js';
  return path.join(pkgDir, entry);
}

async function resolvePathEntry(userPath: string, cwd: string): Promise<string> {
  const resolved = resolveSafePath(userPath, cwd);
  const stat = await fs.stat(resolved);
  if (stat.isDirectory()) {
    const pkgJsonPath = path.join(resolved, 'package.json');
    if (await fileExists(pkgJsonPath)) {
      const raw = JSON.parse(await fs.readFile(pkgJsonPath, 'utf-8')) as { main?: string; module?: string };
      return path.join(resolved, raw.module || raw.main || 'index.js');
    }
    for (const name of ['index.js', 'index.mjs', 'index.ts']) {
      const candidate = path.join(resolved, name);
      if (await fileExists(candidate)) {
        return candidate;
      }
    }
    throw new Error(`Plugin directory has no entry file: ${resolved}`);
  }
  return resolved;
}

async function discoverNodeModulesPlugins(cwd: string): Promise<string[]> {
  const names: string[] = [];
  const nm = path.join(cwd, 'node_modules');
  if (!(await fileExists(nm))) {
    return names;
  }

  const entries = await fs.readdir(nm, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) {
      continue;
    }
    if (entry.name.startsWith('@')) {
      const scoped = path.join(nm, entry.name);
      const scopedEntries = await fs.readdir(scoped, { withFileTypes: true });
      for (const inner of scopedEntries) {
        const full = `${entry.name}/${inner.name}`;
        if (PLUGIN_NAME_RE.test(full)) {
          names.push(full);
        }
      }
    } else if (PLUGIN_NAME_RE.test(entry.name)) {
      names.push(entry.name);
    }
  }

  return names;
}

export async function loadPlugins(options: PluginLoadOptions = {}): Promise<LoadedPlugin[]> {
  const cwd = options.cwd ?? process.cwd();
  const loaded: LoadedPlugin[] = [];
  const seen = new Set<string>();

  const packageNames = [...(options.packages ?? [])];
  if (options.autoDiscover !== false) {
    for (const name of await discoverNodeModulesPlugins(cwd)) {
      if (!packageNames.includes(name)) {
        packageNames.push(name);
      }
    }
  }

  for (const name of packageNames) {
    const entry = await resolvePackageEntry(name, cwd);
    const key = path.resolve(entry);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const mod = await import(pathToFileURL(entry).href);
    loaded.push(normalizePlugin(mod, name, `package:${name}`));
  }

  for (const userPath of options.paths ?? []) {
    const entry = await resolvePathEntry(userPath, cwd);
    const key = path.resolve(entry);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const mod = await import(pathToFileURL(entry).href);
    loaded.push(normalizePlugin(mod, path.basename(userPath), `path:${userPath}`));
  }

  return loaded;
}

export function composeHooks(plugins: LoadedPlugin[]): PluginHooks {
  return {
    async beforeScan(ctx: PluginScanContext) {
      for (const plugin of plugins) {
        await plugin.hooks?.beforeScan?.(ctx);
      }
    },
    async afterScan(ctx: PluginScanContext & { results: ScanResults }) {
      for (const plugin of plugins) {
        await plugin.hooks?.afterScan?.(ctx);
      }
    },
    async onError(error: Error, ctx: PluginScanContext) {
      for (const plugin of plugins) {
        await plugin.hooks?.onError?.(error, ctx);
      }
    },
  };
}

export async function createScanRegistry(options: {
  enabled?: string[];
  disabled?: string[];
  plugins?: PluginLoadOptions;
  cwd?: string;
} = {}): Promise<ScanRegistryResult> {
  const cwd = options.cwd ?? options.plugins?.cwd ?? process.cwd();
  const registry = new DetectorRegistry();
  registerDetectors(registry, {
    enabled: options.enabled,
    disabled: options.disabled,
  });

  const plugins = await loadPlugins({
    ...options.plugins,
    cwd,
  });

  const disabled = new Set((options.disabled ?? []).map(canonicalDetectorId));
  const enableAll = !options.enabled?.length || options.enabled.includes('all');
  const wanted = new Set((options.enabled ?? []).map(canonicalDetectorId));

  for (const plugin of plugins) {
    for (const detector of plugin.detectors) {
      if (disabled.has(detector.id)) {
        continue;
      }
      if (!enableAll && !wanted.has(detector.id)) {
        continue;
      }
      if (registry.has(detector.id)) {
        throw new Error(
          `Plugin '${plugin.name}' detector id '${detector.id}' collides with an existing detector`
        );
      }
      registry.register(detector);
    }
  }

  if (!enableAll) {
    const missing = [...wanted].filter((id) => id !== 'all' && !registry.has(id) && !disabled.has(id));
    if (missing.length > 0) {
      throw new Error(
        `Unknown detector(s): ${missing.join(', ')}. Available: ${registry.list().join(', ')}`
      );
    }
  }

  return {
    registry,
    plugins,
    hooks: composeHooks(plugins),
  };
}
