import { describe, it, expect } from 'vitest';
import { ConfigSchema, DEFAULT_CONFIG, mergeConfigs } from '../src/config/schema.js';

describe('Config System', () => {
  describe('ConfigSchema', () => {
    it('should validate a valid config', () => {
      const validConfig = {
        crawler: {
          maxDepth: 5,
          maxPages: 50,
        },
        bundle: {
          enabled: true,
        },
      };

      const result = ConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
    });

    it('should reject invalid config', () => {
      const invalidConfig = {
        crawler: {
          maxDepth: 100, // Max is 10
        },
      };

      const result = ConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should allow empty config', () => {
      const result = ConfigSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('DEFAULT_CONFIG', () => {
    it('should have all required fields', () => {
      expect(DEFAULT_CONFIG).toHaveProperty('detectors');
      expect(DEFAULT_CONFIG).toHaveProperty('crawler');
      expect(DEFAULT_CONFIG).toHaveProperty('browser');
      expect(DEFAULT_CONFIG).toHaveProperty('output');
      expect(DEFAULT_CONFIG).toHaveProperty('thresholds');
      expect(DEFAULT_CONFIG).toHaveProperty('bundle');
    });

    it('should have sensible defaults', () => {
      expect(DEFAULT_CONFIG.crawler.maxDepth).toBe(3);
      expect(DEFAULT_CONFIG.crawler.maxPages).toBe(100);
      expect(DEFAULT_CONFIG.browser.headless).toBe(true);
      expect(DEFAULT_CONFIG.output.format).toBe('text');
      expect(DEFAULT_CONFIG.bundle.enabled).toBe(false);
    });
  });

  describe('mergeConfigs', () => {
    it('should return defaults when no configs provided', () => {
      const result = mergeConfigs();
      expect(result).toEqual(DEFAULT_CONFIG);
    });

    it('should override defaults with provided config', () => {
      const customConfig = {
        crawler: {
          maxDepth: 5,
        },
      };

      const result = mergeConfigs(customConfig);
      expect(result.crawler.maxDepth).toBe(5);
      expect(result.crawler.maxPages).toBe(100); // Should keep default
    });

    it('should merge multiple configs with priority', () => {
      const fileConfig = {
        crawler: {
          maxDepth: 5,
          maxPages: 50,
        },
      };

      const cliConfig = {
        crawler: {
          maxDepth: 7, // Should override fileConfig
        },
      };

      const result = mergeConfigs(fileConfig, cliConfig);
      expect(result.crawler.maxDepth).toBe(7); // CLI wins
      expect(result.crawler.maxPages).toBe(50); // From fileConfig
      expect(result.crawler.rateLimit).toBe(100); // From defaults
    });

    it('should merge nested objects correctly', () => {
      const config1 = {
        detectors: {
          enabled: ['js-errors', 'network-errors'],
        },
      };

      const config2 = {
        detectors: {
          disabled: ['accessibility'],
        },
      };

      const result = mergeConfigs(config1, config2);
      expect(result.detectors.enabled).toEqual(['js-errors', 'network-errors']);
      expect(result.detectors.disabled).toEqual(['accessibility']);
    });
  });
});
