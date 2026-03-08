import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadConfig, validateConfig, generateExampleConfig } from '../../src/config/loader.js';
import { DEFAULT_CONFIG } from '../../src/config/schema.js';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  };
});

describe('Config Loader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadConfig', () => {
    describe('with no config files', () => {
      it('should return default config when no config files found', async () => {
        vi.mocked(fs.existsSync).mockReturnValue(false);

        const config = await loadConfig();

        expect(config).toEqual(DEFAULT_CONFIG);
      });

      it('should search in custom cwd directory', async () => {
        vi.mocked(fs.existsSync).mockReturnValue(false);

        await loadConfig({ cwd: '/custom/path' });

        expect(fs.existsSync).toHaveBeenCalledWith('/custom/path/.reprorc.json');
        expect(fs.existsSync).toHaveBeenCalledWith('/custom/path/.reprorc.js');
        expect(fs.existsSync).toHaveBeenCalledWith('/custom/path/package.json');
      });
    });

    describe('with .reprorc.json', () => {
      it('should load valid JSON config', async () => {
        const mockConfig = {
          crawler: {
            maxDepth: 5,
            maxPages: 50
          }
        };

        vi.mocked(fs.existsSync).mockImplementation((p) =>
          String(p).endsWith('.reprorc.json')
        );
        vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig));

        const config = await loadConfig();

        expect(config.crawler.maxDepth).toBe(5);
        expect(config.crawler.maxPages).toBe(50);
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Loaded config'));
      });

      it('should merge with defaults for partial config', async () => {
        const partialConfig = {
          crawler: { maxDepth: 10 }
        };

        vi.mocked(fs.existsSync).mockImplementation((p) =>
          String(p).endsWith('.reprorc.json')
        );
        vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(partialConfig));

        const config = await loadConfig();

        expect(config.crawler.maxDepth).toBe(10);
        // Should have defaults for other fields
        expect(config.browser).toBeDefined();
        expect(config.output).toBeDefined();
      });

      it('should handle invalid JSON gracefully', async () => {
        vi.mocked(fs.existsSync).mockImplementation((p) =>
          String(p).endsWith('.reprorc.json')
        );
        vi.mocked(fs.readFileSync).mockReturnValue('{ invalid json }');

        const config = await loadConfig();

        // Should fall back to defaults after warning
        expect(console.warn).toHaveBeenCalled();
        expect(config).toEqual(DEFAULT_CONFIG);
      });

      it('should skip empty config and return defaults', async () => {
        vi.mocked(fs.existsSync).mockImplementation((p) =>
          String(p).endsWith('.reprorc.json')
        );
        vi.mocked(fs.readFileSync).mockReturnValue('{}');

        const config = await loadConfig();

        // Empty config should not be used, fall through to defaults
        expect(config).toEqual(DEFAULT_CONFIG);
      });
    });

    describe('with package.json', () => {
      it('should extract repro field from package.json', async () => {
        const packageJson = {
          name: 'my-project',
          version: '1.0.0',
          repro: {
            crawler: { maxDepth: 7 }
          }
        };

        vi.mocked(fs.existsSync).mockImplementation((p) =>
          String(p).endsWith('package.json')
        );
        vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(packageJson));

        const config = await loadConfig();

        expect(config.crawler.maxDepth).toBe(7);
      });

      it('should return defaults when package.json has no repro field', async () => {
        const packageJson = {
          name: 'my-project',
          version: '1.0.0'
        };

        vi.mocked(fs.existsSync).mockImplementation((p) =>
          String(p).endsWith('package.json')
        );
        vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(packageJson));

        const config = await loadConfig();

        expect(config).toEqual(DEFAULT_CONFIG);
      });
    });

    describe('with custom config path', () => {
      it('should load config from custom path', async () => {
        const customConfig = {
          crawler: { maxDepth: 8 }
        };

        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(customConfig));

        const config = await loadConfig({ configPath: '/custom/config.json' });

        expect(config.crawler.maxDepth).toBe(8);
      });

      it('should throw error when custom config path does not exist', async () => {
        vi.mocked(fs.existsSync).mockReturnValue(false);

        await expect(loadConfig({ configPath: '/nonexistent/config.json' }))
          .rejects.toThrow('Config file not found');
      });
    });

    describe('config file priority', () => {
      it('should prefer .reprorc.json over .reprorc.js', async () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ crawler: { maxDepth: 1 } }));

        const config = await loadConfig();

        // First call should be for .reprorc.json
        expect(fs.existsSync).toHaveBeenNthCalledWith(1, expect.stringContaining('.reprorc.json'));
      });
    });
  });

  describe('validateConfig', () => {
    it('should validate and merge valid partial config', () => {
      const partialConfig = {
        crawler: { maxDepth: 5 }
      };

      const result = validateConfig(partialConfig);

      expect(result.crawler.maxDepth).toBe(5);
      expect(result.browser).toBeDefined();
    });

    it('should throw error for invalid config schema', () => {
      const invalidConfig = {
        crawler: { maxDepth: 'not a number' }
      };

      expect(() => validateConfig(invalidConfig)).toThrow('Invalid config');
    });

    it('should accept empty object and return defaults', () => {
      const result = validateConfig({});

      expect(result).toEqual(DEFAULT_CONFIG);
    });

    it('should validate detectors configuration', () => {
      const config = {
        detectors: {
          enabled: ['javascript-errors', 'accessibility'],
          disabled: ['mixed-content']
        }
      };

      const result = validateConfig(config);

      expect(result.detectors.enabled).toEqual(['javascript-errors', 'accessibility']);
      expect(result.detectors.disabled).toEqual(['mixed-content']);
    });

    it('should validate browser configuration', () => {
      const config = {
        browser: {
          headless: false,
          timeout: 60000
        }
      };

      const result = validateConfig(config);

      expect(result.browser.headless).toBe(false);
      expect(result.browser.timeout).toBe(60000);
    });

    it('should validate output configuration', () => {
      const config = {
        output: {
          format: 'html',
          verbose: true
        }
      };

      const result = validateConfig(config);

      expect(result.output.format).toBe('html');
      expect(result.output.verbose).toBe(true);
    });

    it('should validate bundle configuration', () => {
      const config = {
        bundle: {
          enabled: true,
          includeScreenshots: false
        }
      };

      const result = validateConfig(config);

      expect(result.bundle.enabled).toBe(true);
      expect(result.bundle.includeScreenshots).toBe(false);
    });
  });

  describe('generateExampleConfig', () => {
    it('should return valid JSON string', () => {
      const example = generateExampleConfig();

      expect(() => JSON.parse(example)).not.toThrow();
    });

    it('should include all config sections', () => {
      const example = generateExampleConfig();
      const config = JSON.parse(example);

      expect(config.detectors).toBeDefined();
      expect(config.crawler).toBeDefined();
      expect(config.browser).toBeDefined();
      expect(config.output).toBeDefined();
      expect(config.thresholds).toBeDefined();
      expect(config.bundle).toBeDefined();
    });

    it('should have reasonable default values', () => {
      const example = generateExampleConfig();
      const config = JSON.parse(example);

      expect(config.crawler.maxDepth).toBe(3);
      expect(config.crawler.maxPages).toBe(50);
      expect(config.browser.headless).toBe(true);
      expect(config.bundle.enabled).toBe(true);
    });

    it('should include detector arrays', () => {
      const example = generateExampleConfig();
      const config = JSON.parse(example);

      expect(Array.isArray(config.detectors.enabled)).toBe(true);
      expect(Array.isArray(config.detectors.disabled)).toBe(true);
      expect(config.detectors.enabled).toContain('js-errors');
    });
  });
});
