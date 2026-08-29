import { z } from 'zod';
import type { Detector } from '../detectors/base.js';
import type { DetectorRegistry } from '../detectors/registry.js';
import type { ScanResults } from '../scanner/index.js';

export const PluginManifestSchema = z.object({
  name: z.string().min(1),
  version: z.string().optional(),
});

export type PluginManifest = z.infer<typeof PluginManifestSchema>;

export interface PluginScanContext {
  url: string;
  registry: DetectorRegistry;
}

export interface PluginHooks {
  beforeScan?: (ctx: PluginScanContext) => Promise<void> | void;
  afterScan?: (ctx: PluginScanContext & { results: ScanResults }) => Promise<void> | void;
  onError?: (error: Error, ctx: PluginScanContext) => Promise<void> | void;
}

export interface ReproPlugin extends PluginManifest {
  detectors?: Detector[];
  hooks?: PluginHooks;
}

export interface LoadedPlugin extends ReproPlugin {
  source: string;
  detectors: Detector[];
}

export interface PluginLoadOptions {
  /** Explicit npm package names (must already be installed). */
  packages?: string[];
  /** Local module paths, resolved under cwd. */
  paths?: string[];
  /** Discover `repro-plugin-*` packages in node_modules (default: true). */
  autoDiscover?: boolean;
  cwd?: string;
}
