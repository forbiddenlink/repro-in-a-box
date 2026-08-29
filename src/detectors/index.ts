// Base types and interfaces
export * from './base.js';

// Registry
export * from './registry.js';

// Detectors
export { JavaScriptErrorsDetector } from './js-errors.js';
export { NetworkErrorsDetector } from './network-errors.js';
export { BrokenAssetsDetector } from './broken-assets.js';
export { AccessibilityDetector } from './accessibility.js';
export { WebVitalsDetector } from './web-vitals.js';
export { MixedContentDetector } from './mixed-content.js';
export { BrokenLinksDetector } from './broken-links.js';
export { ConsoleWarningsDetector } from './console-warnings.js';
export { SeoDetector } from './seo.js';
export { PerformanceDetector } from './performance.js';
export { SecurityDetector } from './security.js';
export { MemoryLeakDetector } from './memory-leak.js';

// Catalog: single source of truth for ids, aliases, and registration
export {
  DETECTOR_IDS,
  DETECTOR_ALIASES,
  DETECTOR_CHOICES,
  createAllDetectors,
  createDefaultRegistry,
  registerDetectors,
  resolveDetectorIds,
  canonicalDetectorId,
  selectBuiltinIds,
  type DetectorId,
  type RegisterDetectorsOptions,
} from './catalog.js';
