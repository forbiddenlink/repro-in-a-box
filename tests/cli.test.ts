import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scanCommand } from '../src/cli/commands/scan.js';
import { validateCommand } from '../src/cli/commands/validate.js';
import { diffCommand } from '../src/cli/commands/diff.js';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('CLI Commands - Scan', () => {
  describe('Command Configuration', () => {
    it('should have correct command name and description', () => {
      expect(scanCommand.name()).toBe('scan');
      expect(scanCommand.description()).toContain('Scan a website');
    });

    it('should require a URL argument', () => {
      const args = scanCommand.registeredArguments;
      expect(args).toHaveLength(1);
      expect(args[0].name()).toBe('url');
      expect(args[0].required).toBe(true);
    });

    it('should have max-depth option', () => {
      const option = scanCommand.options.find(o => o.long === '--max-depth');
      expect(option).toBeDefined();
      expect(option?.description).toContain('Maximum crawl depth');
      expect(option?.defaultValue).toBe('2');
    });

    it('should have max-pages option', () => {
      const option = scanCommand.options.find(o => o.long === '--max-pages');
      expect(option).toBeDefined();
      expect(option?.description).toContain('Maximum pages');
      expect(option?.defaultValue).toBe('10');
    });

    it('should have rate-limit option', () => {
      const option = scanCommand.options.find(o => o.long === '--rate-limit');
      expect(option).toBeDefined();
      expect(option?.description).toContain('Rate limit');
      expect(option?.defaultValue).toBe('1000');
    });

    it('should have output option', () => {
      const option = scanCommand.options.find(o => o.long === '--output');
      expect(option).toBeDefined();
      expect(option?.description).toContain('Output file path');
    });

    it('should have headless option', () => {
      const option = scanCommand.options.find(o => o.long === '--no-headless');
      expect(option).toBeDefined();
      expect(option?.description).toContain('Run browser in visible mode');
    });

    it('should have bundle option', () => {
      const option = scanCommand.options.find(o => o.long === '--bundle');
      expect(option).toBeDefined();
      expect(option?.description).toContain('reproducible bundle');
    });

    it('should have screenshots option', () => {
      const option = scanCommand.options.find(o => o.long === '--screenshots');
      expect(option).toBeDefined();
      expect(option?.description).toContain('screenshot');
    });

    it('should have record-har option', () => {
      const option = scanCommand.options.find(o => o.long === '--record-har');
      expect(option).toBeDefined();
      expect(option?.description).toContain('HAR');
    });
  });
});

describe('CLI Commands - Validate', () => {
  describe('Command Configuration', () => {
    it('should have correct command name and description', () => {
      expect(validateCommand.name()).toBe('validate');
      expect(validateCommand.description()).toContain('reproducibility');
    });

    it('should require a bundle argument', () => {
      const args = validateCommand.registeredArguments;
      expect(args).toHaveLength(1);
      expect(args[0].name()).toBe('bundle');
      expect(args[0].required).toBe(true);
    });

    it('should have runs option with default value', () => {
      const option = validateCommand.options.find(o => o.long === '--runs');
      expect(option).toBeDefined();
      expect(option?.description).toContain('Number of replay runs');
      expect(option?.defaultValue).toBe('3');
    });

    it('should have output option', () => {
      const option = validateCommand.options.find(o => o.long === '--output');
      expect(option).toBeDefined();
      expect(option?.description).toContain('Output directory');
    });

    it('should have json option', () => {
      const option = validateCommand.options.find(o => o.long === '--json');
      expect(option).toBeDefined();
      expect(option?.description).toContain('JSON');
    });

    it('should have threshold option with default value', () => {
      const option = validateCommand.options.find(o => o.long === '--threshold');
      expect(option).toBeDefined();
      expect(option?.description).toContain('threshold');
      expect(option?.defaultValue).toBe('70');
    });

    it('should have verbose option', () => {
      const option = validateCommand.options.find(o => o.long === '--verbose');
      expect(option).toBeDefined();
      expect(option?.description).toContain('detailed');
    });
  });
});

describe('CLI Commands - Diff', () => {
  describe('Command Configuration', () => {
    it('should have correct command name and description', () => {
      expect(diffCommand.name()).toBe('diff');
      expect(diffCommand.description()).toContain('Compare two scan results');
    });

    it('should require two scan result arguments', () => {
      const args = diffCommand.registeredArguments;
      expect(args).toHaveLength(2);
      expect(args[0].name()).toBe('scan1');
      expect(args[0].required).toBe(true);
      expect(args[1].name()).toBe('scan2');
      expect(args[1].required).toBe(true);
    });

    it('should have output option', () => {
      const option = diffCommand.options.find(o => o.long === '--output');
      expect(option).toBeDefined();
      expect(option?.description).toContain('Output file');
    });
  });
});

describe('CLI Command Option Parsing', () => {
  it('should parse scan command with boolean flags', () => {
    // Test that options are properly defined
    const bundleOption = scanCommand.options.find(o => o.long === '--bundle');
    expect(bundleOption?.flags).toContain('--bundle');
    
    const screenshotsOption = scanCommand.options.find(o => o.long === '--screenshots');
    expect(screenshotsOption?.flags).toContain('--screenshots');
  });

  it('should parse validate command with numeric options', () => {
    const runsOption = validateCommand.options.find(o => o.long === '--runs');
    expect(runsOption?.flags).toContain(' <number>');
    
    const thresholdOption = validateCommand.options.find(o => o.long === '--threshold');
    expect(thresholdOption?.flags).toContain(' <percentage>');
  });

  it('should have all required short flags', () => {
    // Scan command
    const scanDepthOption = scanCommand.options.find(o => o.short === '-d');
    expect(scanDepthOption?.long).toBe('--max-depth');
    
    const scanPagesOption = scanCommand.options.find(o => o.short === '-p');
    expect(scanPagesOption?.long).toBe('--max-pages');
    
    const scanRateOption = scanCommand.options.find(o => o.short === '-r');
    expect(scanRateOption?.long).toBe('--rate-limit');
    
    const scanOutputOption = scanCommand.options.find(o => o.short === '-o');
    expect(scanOutputOption?.long).toBe('--output');
    
    const scanBundleOption = scanCommand.options.find(o => o.short === '-b');
    expect(scanBundleOption?.long).toBe('--bundle');
    
    // Validate command
    const validateRunsOption = validateCommand.options.find(o => o.short === '-r');
    expect(validateRunsOption?.long).toBe('--runs');
    
    const validateOutputOption = validateCommand.options.find(o => o.short === '-o');
    expect(validateOutputOption?.long).toBe('--output');
    
    const validateThresholdOption = validateCommand.options.find(o => o.short === '-t');
    expect(validateThresholdOption?.long).toBe('--threshold');
    
    const validateVerboseOption = validateCommand.options.find(o => o.short === '-v');
    expect(validateVerboseOption?.long).toBe('--verbose');
    
    // Diff command
    const diffOutputOption = diffCommand.options.find(o => o.short === '-o');
    expect(diffOutputOption?.long).toBe('--output');
  });
});
