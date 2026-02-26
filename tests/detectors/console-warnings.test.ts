import { describe, it, expect, beforeEach } from 'vitest';
import { ConsoleWarningsDetector } from '../../src/detectors/console-warnings.js';
import { IssueCategory, IssueSeverity } from '../../src/detectors/base.js';

describe('ConsoleWarningsDetector', () => {
  let detector: ConsoleWarningsDetector;

  beforeEach(() => {
    detector = new ConsoleWarningsDetector();
  });

  describe('metadata', () => {
    it('should have correct id', () => {
      expect(detector.id).toBe('console-warnings');
    });

    it('should have correct name', () => {
      expect(detector.name).toBe('Console Warnings');
    });

    it('should have correct category', () => {
      expect(detector.category).toBe(IssueCategory.CONSOLE);
    });

    it('should have description', () => {
      expect(detector.description).toContain('console warnings');
    });
  });

  describe('warning categorization', () => {
    it('should detect deprecation warnings', () => {
      // Use the categorizeWarning method via reflection
      const categorize = (detector as unknown as { categorizeWarning: (msg: string) => IssueSeverity }).categorizeWarning.bind(detector);

      expect(categorize('This method is deprecated')).toBe(IssueSeverity.WARNING);
      expect(categorize('will be removed in the next version')).toBe(IssueSeverity.WARNING);
      expect(categorize('is no longer supported')).toBe(IssueSeverity.WARNING);
    });

    it('should detect React unmounted component warnings', () => {
      const categorize = (detector as unknown as { categorizeWarning: (msg: string) => IssueSeverity }).categorizeWarning.bind(detector);

      expect(categorize("Can't perform a React state update on an unmounted component")).toBe(IssueSeverity.WARNING);
    });

    it('should categorize other warnings as INFO', () => {
      const categorize = (detector as unknown as { categorizeWarning: (msg: string) => IssueSeverity }).categorizeWarning.bind(detector);

      expect(categorize('Some generic warning message')).toBe(IssueSeverity.INFO);
    });
  });

  describe('framework detection', () => {
    it('should detect React warnings', () => {
      const detectFramework = (detector as unknown as { detectFramework: (msg: string) => string | null }).detectFramework.bind(detector);

      expect(detectFramework('Warning: Each child in a list should have a unique "key" prop')).toBe('react');
      expect(detectFramework("Warning: Can't perform a React state update on an unmounted component")).toBe('react');
      expect(detectFramework('Warning: componentWillMount has been renamed')).toBe('react');
    });

    it('should detect Vue warnings', () => {
      const detectFramework = (detector as unknown as { detectFramework: (msg: string) => string | null }).detectFramework.bind(detector);

      expect(detectFramework('[Vue warn]: Something went wrong')).toBe('vue');
    });

    it('should detect Angular warnings', () => {
      const detectFramework = (detector as unknown as { detectFramework: (msg: string) => string | null }).detectFramework.bind(detector);

      expect(detectFramework('ExpressionChangedAfterItHasBeenCheckedError')).toBe('angular');
    });

    it('should return null for unknown frameworks', () => {
      const detectFramework = (detector as unknown as { detectFramework: (msg: string) => string | null }).detectFramework.bind(detector);

      expect(detectFramework('Some random warning')).toBeNull();
    });
  });

  describe('cleanup', () => {
    it('should clear warnings on cleanup', async () => {
      await detector.cleanup();
      const issues = detector.issues;
      expect(issues).toHaveLength(0);
    });
  });
});
