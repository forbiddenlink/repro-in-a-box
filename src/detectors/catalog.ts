import type { Detector } from './base.js';
import { DetectorRegistry } from './registry.js';
import { JavaScriptErrorsDetector } from './js-errors.js';
import { NetworkErrorsDetector } from './network-errors.js';
import { BrokenAssetsDetector } from './broken-assets.js';
import { AccessibilityDetector } from './accessibility.js';
import { WebVitalsDetector } from './web-vitals.js';
import { MixedContentDetector } from './mixed-content.js';
import { BrokenLinksDetector } from './broken-links.js';
import { ConsoleWarningsDetector } from './console-warnings.js';
import { SeoDetector } from './seo.js';
import { PerformanceDetector } from './performance.js';
import { SecurityDetector } from './security.js';
import { MemoryLeakDetector } from './memory-leak.js';

/**
 * Canonical detector IDs — must match each class `id` field.
 */
export const DETECTOR_IDS = [
  'js-errors',
  'network-errors',
  'broken-assets',
  'accessibility',
  'web-vitals',
  'mixed-content',
  'broken-links',
  'console-warnings',
  'seo',
  'performance',
  'security',
  'memory-leak',
] as const;

export type DetectorId = (typeof DETECTOR_IDS)[number];

/**
 * Historical / docs aliases → canonical class ids.
 * `javascript-errors` was documented after a failed unification; the
 * implementation id has always been `js-errors`.
 */
export const DETECTOR_ALIASES: Record<string, DetectorId> = {
  'javascript-errors': 'js-errors',
};

export const DETECTOR_ID_SET = new Set<string>(DETECTOR_IDS);

export interface DetectorChoice {
  name: string;
  value: DetectorId;
  checked: boolean;
}

export const DETECTOR_CHOICES: DetectorChoice[] = [
  { name: 'JavaScript Errors', value: 'js-errors', checked: true },
  { name: 'Network Errors', value: 'network-errors', checked: true },
  { name: 'Broken Assets', value: 'broken-assets', checked: true },
  { name: 'Accessibility (WCAG 2.1)', value: 'accessibility', checked: true },
  { name: 'Web Vitals (Core Web Vitals)', value: 'web-vitals', checked: true },
  { name: 'Mixed Content (HTTP/HTTPS)', value: 'mixed-content', checked: true },
  { name: 'Broken Links', value: 'broken-links', checked: true },
  { name: 'Console Warnings', value: 'console-warnings', checked: true },
  { name: 'SEO', value: 'seo', checked: true },
  { name: 'Performance', value: 'performance', checked: true },
  { name: 'Security (headers, cookies, SRI)', value: 'security', checked: true },
  { name: 'Memory Leaks', value: 'memory-leak', checked: false },
];

export function createAllDetectors(): Detector[] {
  return [
    new JavaScriptErrorsDetector(),
    new NetworkErrorsDetector(),
    new BrokenAssetsDetector(),
    new AccessibilityDetector(),
    new WebVitalsDetector(),
    new MixedContentDetector(),
    new BrokenLinksDetector(),
    new ConsoleWarningsDetector(),
    new SeoDetector(),
    new PerformanceDetector(),
    new SecurityDetector(),
    new MemoryLeakDetector(),
  ];
}

export function canonicalDetectorId(id: string): string {
  return DETECTOR_ALIASES[id] ?? id;
}

export function resolveDetectorIds(requested?: string[]): DetectorId[] {
  if (!requested || requested.length === 0 || requested.includes('all')) {
    return [...DETECTOR_IDS];
  }

  const resolved: DetectorId[] = [];
  const seen = new Set<string>();

  for (const raw of requested) {
    const id = canonicalDetectorId(raw);
    if (!DETECTOR_ID_SET.has(id)) {
      throw new Error(
        `Unknown detector '${raw}'. Valid ids: ${DETECTOR_IDS.join(', ')} (alias: javascript-errors)`
      );
    }
    if (!seen.has(id)) {
      seen.add(id);
      resolved.push(id as DetectorId);
    }
  }

  return resolved;
}

/** Builtin ids only — unknown ids are ignored so plugins can supply them later. */
export function selectBuiltinIds(requested?: string[]): DetectorId[] {
  if (!requested || requested.length === 0 || requested.includes('all')) {
    return [...DETECTOR_IDS];
  }

  const resolved: DetectorId[] = [];
  const seen = new Set<string>();

  for (const raw of requested) {
    const id = canonicalDetectorId(raw);
    if (!DETECTOR_ID_SET.has(id) || seen.has(id)) {
      continue;
    }
    seen.add(id);
    resolved.push(id as DetectorId);
  }

  return resolved;
}

export interface RegisterDetectorsOptions {
  enabled?: string[];
  disabled?: string[];
}

/**
 * Register detectors on a registry. Returns the canonical ids that were registered.
 */
export function registerDetectors(
  registry: DetectorRegistry,
  options: RegisterDetectorsOptions = {}
): DetectorId[] {
  const detectors = createAllDetectors();
  const byId = new Map(detectors.map((d) => [d.id, d]));
  const disabled = new Set((options.disabled ?? []).map(canonicalDetectorId));
  const enabled = selectBuiltinIds(options.enabled).filter((id) => !disabled.has(id));

  for (const id of enabled) {
    const detector = byId.get(id);
    if (detector) {
      registry.register(detector);
    }
  }

  return enabled;
}

export function createDefaultRegistry(options: RegisterDetectorsOptions = {}): DetectorRegistry {
  const registry = new DetectorRegistry();
  registerDetectors(registry, options);
  return registry;
}
