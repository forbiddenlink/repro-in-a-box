import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initCommand } from '../../src/cli/commands/init.js';

// Mock inquirer
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn()
  }
}));

// Mock fs
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    writeFileSync: vi.fn(),
  };
});

import inquirer from 'inquirer';
import * as fs from 'fs';

// Helper to parse config content (JSON or JS)
function parseConfig(content: string): Record<string, unknown> {
  const str = String(content);
  if (str.startsWith('export default')) {
    // JS format: extract JSON from "export default {...};\n"
    const jsonStr = str.replace('export default ', '').replace(/;\n?$/, '');
    return JSON.parse(jsonStr);
  }
  return JSON.parse(str);
}

describe('Init Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Command Configuration', () => {
    it('should have correct command name', () => {
      expect(initCommand.name()).toBe('init');
    });

    it('should have correct description', () => {
      expect(initCommand.description()).toContain('configuration file');
    });

    it('should have output option with default value', () => {
      const option = initCommand.options.find(o => o.long === '--output');
      expect(option).toBeDefined();
      expect(option?.defaultValue).toBe('.reprorc.json');
    });

    it('should have --json option', () => {
      const option = initCommand.options.find(o => o.long === '--json');
      expect(option).toBeDefined();
    });

    it('should have --js option', () => {
      const option = initCommand.options.find(o => o.long === '--js');
      expect(option).toBeDefined();
    });

    it('should have short flags', () => {
      const outputOption = initCommand.options.find(o => o.short === '-o');
      expect(outputOption?.long).toBe('--output');
    });
  });

  describe('Action Handler', () => {
    const mockAnswers = {
      detectors: ['javascript-errors', 'network-errors', 'accessibility'],
      maxDepth: 3,
      maxPages: 100,
      rateLimit: 100,
      outputFormat: 'json',
      verbose: false,
      minReproducibility: 70,
      bundleEnabled: true,
      includeScreenshots: true,
    };

    beforeEach(() => {
      vi.mocked(inquirer.prompt).mockResolvedValue(mockAnswers);
    });

    it('should prompt user with inquirer', async () => {
      await initCommand.parseAsync(['node', 'test', 'init']);

      expect(inquirer.prompt).toHaveBeenCalled();
    });

    it('should write config file', async () => {
      await initCommand.parseAsync(['node', 'test', 'init']);

      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should write JSON config file by default', async () => {
      await initCommand.parseAsync(['node', 'test', 'init']);

      expect(fs.writeFileSync).toHaveBeenCalled();
      const [filePath, content] = vi.mocked(fs.writeFileSync).mock.calls[0];
      expect(String(filePath)).toMatch(/\.reprorc\.json$/);
      expect(() => parseConfig(String(content))).not.toThrow();
    });

    it('should write JS config file when --js flag is used', async () => {
      await initCommand.parseAsync(['node', 'test', 'init', '--js']);

      expect(fs.writeFileSync).toHaveBeenCalled();
      const [filePath, content] = vi.mocked(fs.writeFileSync).mock.calls[0];
      expect(String(filePath)).toMatch(/\.reprorc\.js$/);
      expect(String(content)).toContain('export default');
    });

    it('should include detectors in config', async () => {
      await initCommand.parseAsync(['node', 'test', 'init']);

      const [, content] = vi.mocked(fs.writeFileSync).mock.calls[0];
      const config = parseConfig(String(content));

      expect(config.detectors.enabled).toEqual(mockAnswers.detectors);
    });

    it('should include crawler settings in config', async () => {
      await initCommand.parseAsync(['node', 'test', 'init']);

      const [, content] = vi.mocked(fs.writeFileSync).mock.calls[0];
      const config = parseConfig(String(content));

      expect(config.crawler.maxDepth).toBe(mockAnswers.maxDepth);
      expect(config.crawler.maxPages).toBe(mockAnswers.maxPages);
      expect(config.crawler.rateLimit).toBe(mockAnswers.rateLimit);
    });

    it('should include output settings in config', async () => {
      await initCommand.parseAsync(['node', 'test', 'init']);

      const [, content] = vi.mocked(fs.writeFileSync).mock.calls[0];
      const config = parseConfig(String(content));

      expect(config.output.format).toBe(mockAnswers.outputFormat);
      expect(config.output.verbose).toBe(mockAnswers.verbose);
    });

    it('should include thresholds in config', async () => {
      await initCommand.parseAsync(['node', 'test', 'init']);

      const [, content] = vi.mocked(fs.writeFileSync).mock.calls[0];
      const config = parseConfig(String(content));

      expect(config.thresholds.minReproducibility).toBe(mockAnswers.minReproducibility);
    });

    it('should include bundle settings in config', async () => {
      await initCommand.parseAsync(['node', 'test', 'init']);

      const [, content] = vi.mocked(fs.writeFileSync).mock.calls[0];
      const config = parseConfig(String(content));

      expect(config.bundle.enabled).toBe(mockAnswers.bundleEnabled);
      expect(config.bundle.includeScreenshots).toBe(mockAnswers.includeScreenshots);
    });

    it('should handle bundleEnabled=false correctly', async () => {
      vi.mocked(inquirer.prompt).mockResolvedValue({
        ...mockAnswers,
        bundleEnabled: false,
        includeScreenshots: undefined,
      });

      await initCommand.parseAsync(['node', 'test', 'init']);

      const [, content] = vi.mocked(fs.writeFileSync).mock.calls[0];
      const config = parseConfig(String(content));

      expect(config.bundle.enabled).toBe(false);
      expect(config.bundle.includeScreenshots).toBe(true);
    });

    it('should print success message after writing config', async () => {
      await initCommand.parseAsync(['node', 'test', 'init']);

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Configuration saved'));
    });

    it('should format JSON with proper indentation', async () => {
      await initCommand.parseAsync(['node', 'test', 'init']);

      const [, content] = vi.mocked(fs.writeFileSync).mock.calls[0];
      const contentStr = String(content);

      expect(contentStr).toContain('\n');
      expect(contentStr).toContain('  ');
    });

    it('should convert .json to .js when --js flag used', async () => {
      await initCommand.parseAsync(['node', 'test', 'init', '--js']);

      const [filePath, content] = vi.mocked(fs.writeFileSync).mock.calls[0];
      expect(String(filePath)).toMatch(/\.js$/);
      expect(String(content)).toContain('export default');
    });
  });

  describe('Inquirer prompt configuration', () => {
    beforeEach(() => {
      vi.mocked(inquirer.prompt).mockResolvedValue({
        detectors: [],
        maxDepth: 3,
        maxPages: 100,
        rateLimit: 100,
        outputFormat: 'json',
        verbose: false,
        minReproducibility: 70,
        bundleEnabled: true,
        includeScreenshots: true,
      });
    });

    it('should pass prompt questions to inquirer', async () => {
      await initCommand.parseAsync(['node', 'test', 'init']);

      expect(inquirer.prompt).toHaveBeenCalled();
      const promptArg = vi.mocked(inquirer.prompt).mock.calls[0][0];
      expect(Array.isArray(promptArg)).toBe(true);
      expect(promptArg.length).toBeGreaterThan(0);
    });

    it('should include detectors checkbox question', async () => {
      await initCommand.parseAsync(['node', 'test', 'init']);

      const promptArg = vi.mocked(inquirer.prompt).mock.calls[0][0] as Array<{ name: string; type: string }>;
      const detectorsQ = promptArg.find(q => q.name === 'detectors');
      expect(detectorsQ).toBeDefined();
      expect(detectorsQ?.type).toBe('checkbox');
    });

    it('should include maxDepth number question', async () => {
      await initCommand.parseAsync(['node', 'test', 'init']);

      const promptArg = vi.mocked(inquirer.prompt).mock.calls[0][0] as Array<{ name: string; type: string }>;
      const maxDepthQ = promptArg.find(q => q.name === 'maxDepth');
      expect(maxDepthQ).toBeDefined();
      expect(maxDepthQ?.type).toBe('number');
    });

    it('should include outputFormat list question', async () => {
      await initCommand.parseAsync(['node', 'test', 'init']);

      const promptArg = vi.mocked(inquirer.prompt).mock.calls[0][0] as Array<{ name: string; type: string }>;
      const formatQ = promptArg.find(q => q.name === 'outputFormat');
      expect(formatQ).toBeDefined();
      expect(formatQ?.type).toBe('list');
    });

    it('should include bundleEnabled confirm question', async () => {
      await initCommand.parseAsync(['node', 'test', 'init']);

      const promptArg = vi.mocked(inquirer.prompt).mock.calls[0][0] as Array<{ name: string; type: string }>;
      const bundleQ = promptArg.find(q => q.name === 'bundleEnabled');
      expect(bundleQ).toBeDefined();
      expect(bundleQ?.type).toBe('confirm');
    });
  });
});
