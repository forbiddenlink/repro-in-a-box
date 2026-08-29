/**
 * Public library API for plugin authors and programmatic scans.
 */
export {
  BaseDetector,
  IssueCategory,
  IssueSeverity,
  DetectorRegistry,
  DETECTOR_IDS,
  createDefaultRegistry,
  createAllDetectors,
} from './detectors/index.js';
export type {
  Detector,
  DetectorConfig,
  DetectorResult,
  Issue,
} from './detectors/base.js';

export { Scanner } from './scanner/index.js';
export type { ScanConfig, ScanResults, PageScanResult } from './scanner/index.js';

export {
  createScanRegistry,
  loadPlugins,
  PluginManifestSchema,
} from './plugins/index.js';
export type {
  ReproPlugin,
  PluginHooks,
  PluginLoadOptions,
  LoadedPlugin,
} from './plugins/index.js';
