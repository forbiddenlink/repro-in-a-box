import { describe, it, expect } from 'vitest';
import {
  DETECTOR_IDS,
  DETECTOR_CHOICES,
  createAllDetectors,
  createDefaultRegistry,
  resolveDetectorIds,
  canonicalDetectorId,
} from '../../src/detectors/catalog.js';

describe('detector catalog', () => {
  it('lists 12 canonical detector ids', () => {
    expect(DETECTOR_IDS).toHaveLength(12);
    expect(DETECTOR_IDS).toContain('js-errors');
    expect(DETECTOR_IDS).toContain('security');
    expect(DETECTOR_IDS).toContain('memory-leak');
  });

  it('creates one instance per canonical id', () => {
    const detectors = createAllDetectors();
    expect(detectors.map((d) => d.id).sort()).toEqual([...DETECTOR_IDS].sort());
  });

  it('registers all detectors by default', () => {
    const registry = createDefaultRegistry();
    expect(registry.size).toBe(12);
    expect(registry.has('js-errors')).toBe(true);
    expect(registry.has('security')).toBe(true);
    expect(registry.has('memory-leak')).toBe(true);
    expect(registry.has('javascript-errors')).toBe(false);
  });

  it('maps javascript-errors alias to js-errors', () => {
    expect(canonicalDetectorId('javascript-errors')).toBe('js-errors');
    expect(resolveDetectorIds(['javascript-errors'])).toEqual(['js-errors']);
  });

  it('honors enabled and disabled lists', () => {
    const registry = createDefaultRegistry({
      enabled: ['javascript-errors', 'security'],
      disabled: ['security'],
    });
    expect(registry.list()).toEqual(['js-errors']);
  });

  it('rejects unknown detector ids', () => {
    expect(() => resolveDetectorIds(['not-a-detector'])).toThrow(/Unknown detector/);
  });

  it('exposes wizard choices for every detector', () => {
    expect(DETECTOR_CHOICES.map((c) => c.value).sort()).toEqual([...DETECTOR_IDS].sort());
  });
});
