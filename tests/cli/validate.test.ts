import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateCommand } from '../../src/cli/commands/validate.js';

describe('Validate Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Command Configuration', () => {
    it('should have correct command name', () => {
      expect(validateCommand.name()).toBe('validate');
    });

    it('should have correct description', () => {
      expect(validateCommand.description()).toContain('reproducibility');
    });

    it('should require bundle argument', () => {
      const args = validateCommand.registeredArguments;
      expect(args).toHaveLength(1);
      expect(args[0].name()).toBe('bundle');
      expect(args[0].required).toBe(true);
    });

    it('should have --runs option with default 3', () => {
      const option = validateCommand.options.find(o => o.long === '--runs');
      expect(option).toBeDefined();
      expect(option?.defaultValue).toBe('3');
      expect(option?.description).toContain('replay runs');
    });

    it('should have --threshold option with default 70', () => {
      const option = validateCommand.options.find(o => o.long === '--threshold');
      expect(option).toBeDefined();
      expect(option?.defaultValue).toBe('70');
      expect(option?.description).toContain('threshold');
    });

    it('should have --json option', () => {
      const option = validateCommand.options.find(o => o.long === '--json');
      expect(option).toBeDefined();
      expect(option?.description).toContain('JSON');
    });

    it('should have --verbose option', () => {
      const option = validateCommand.options.find(o => o.long === '--verbose');
      expect(option).toBeDefined();
      expect(option?.description).toContain('detailed');
    });

    it('should have --output option', () => {
      const option = validateCommand.options.find(o => o.long === '--output');
      expect(option).toBeDefined();
      expect(option?.description).toContain('Output');
    });

    it('should have short -r flag for runs', () => {
      const option = validateCommand.options.find(o => o.short === '-r');
      expect(option).toBeDefined();
      expect(option?.long).toBe('--runs');
    });

    it('should have short -t flag for threshold', () => {
      const option = validateCommand.options.find(o => o.short === '-t');
      expect(option).toBeDefined();
      expect(option?.long).toBe('--threshold');
    });

    it('should have short -v flag for verbose', () => {
      const option = validateCommand.options.find(o => o.short === '-v');
      expect(option).toBeDefined();
      expect(option?.long).toBe('--verbose');
    });

    it('should have short -o flag for output', () => {
      const option = validateCommand.options.find(o => o.short === '-o');
      expect(option).toBeDefined();
      expect(option?.long).toBe('--output');
    });
  });

  describe('Option parsing', () => {
    it('should accept numeric value for runs', () => {
      const option = validateCommand.options.find(o => o.long === '--runs');
      expect(option?.flags).toContain('<number>');
    });

    it('should accept percentage value for threshold', () => {
      const option = validateCommand.options.find(o => o.long === '--threshold');
      expect(option?.flags).toContain('<percentage>');
    });

    it('should accept directory value for output', () => {
      const option = validateCommand.options.find(o => o.long === '--output');
      expect(option?.flags).toContain('<dir>');
    });
  });
});

describe('Validate Command Thresholds', () => {
  // These tests verify the threshold constants used in the command
  // by checking the command's description and default values

  it('should use 70 as default threshold', () => {
    const option = validateCommand.options.find(o => o.long === '--threshold');
    expect(option?.defaultValue).toBe('70');
  });

  it('should use 3 as default runs', () => {
    const option = validateCommand.options.find(o => o.long === '--runs');
    expect(option?.defaultValue).toBe('3');
  });
});
