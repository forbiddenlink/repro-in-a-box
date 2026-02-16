import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { ConfigSchema, type ReproConfig, DEFAULT_CONFIG, mergeConfigs } from './schema.js';

/**
 * Config file loader for Repro-in-a-Box
 * Searches for config in:
 * 1. .reprorc.json
 * 2. .reprorc.js
 * 3. package.json (repro field)
 * 4. Custom path via --config flag
 */

export interface LoadConfigOptions {
  /** Custom config file path */
  configPath?: string;
  /** Directory to search for config files */
  cwd?: string;
}

/**
 * Load config from file system
 */
export async function loadConfig(options: LoadConfigOptions = {}): Promise<ReproConfig> {
  const cwd = options.cwd || process.cwd();
  
  // If custom config path provided, use it
  if (options.configPath) {
    return loadConfigFromPath(options.configPath);
  }
  
  // Search for config files in order of preference
  const configFiles = [
    join(cwd, '.reprorc.json'),
    join(cwd, '.reprorc.js'),
    join(cwd, 'package.json'),
  ];
  
  for (const filePath of configFiles) {
    if (existsSync(filePath)) {
      try {
        const config = await loadConfigFromPath(filePath);
        if (config && Object.keys(config).length > 0) {
          console.log(`📝 Loaded config from ${filePath.split('/').pop()}`);
          return config;
        }
      } catch (error) {
        console.warn(`⚠️  Failed to load config from ${filePath}:`, (error as Error).message);
      }
    }
  }
  
  // No config file found, return defaults
  return DEFAULT_CONFIG;
}

/**
 * Load and validate config from a specific path
 */
async function loadConfigFromPath(filePath: string): Promise<ReproConfig> {
  if (!existsSync(filePath)) {
    throw new Error(`Config file not found: ${filePath}`);
  }
  
  let rawConfig: unknown;
  
  // JSON files
  if (filePath.endsWith('.json')) {
    const content = readFileSync(filePath, 'utf-8');
    try {
      const json = JSON.parse(content);
      
      // If package.json, extract repro field
      if (filePath.endsWith('package.json')) {
        rawConfig = json.repro || {};
      } else {
        rawConfig = json;
      }
    } catch (error) {
      throw new Error(`Failed to parse JSON config file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  // JavaScript files
  else if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) {
    try {
      // Dynamic import for ES modules
      const module = await import(filePath);
      rawConfig = module.default || module;
    } catch (error) {
      throw new Error(`Failed to import JavaScript config file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  else {
    throw new Error(`Unsupported config file format: ${filePath}`);
  }
  
  // Validate with Zod schema
  const result = ConfigSchema.safeParse(rawConfig);
  
  if (!result.success) {
    throw new Error(`Invalid config: ${result.error.message}`);
  }
  
  // Merge with defaults
  return mergeConfigs(DEFAULT_CONFIG, result.data);
}

/**
 * Validate config object without loading from file
 */
export function validateConfig(config: unknown): ReproConfig {
  const result = ConfigSchema.safeParse(config);
  
  if (!result.success) {
    throw new Error(`Invalid config: ${result.error.message}`);
  }
  
  return mergeConfigs(DEFAULT_CONFIG, result.data);
}

/**
 * Generate example config file content
 */
export function generateExampleConfig(): string {
  const example = {
    detectors: {
      enabled: ['js-errors', 'accessibility', 'web-vitals'],
      disabled: ['mixed-content'],
    },
    crawler: {
      maxDepth: 3,
      maxPages: 50,
      rateLimit: 200,
    },
    browser: {
      headless: true,
      timeout: 30000,
    },
    output: {
      format: 'json',
      path: './scan-results',
      verbose: false,
    },
    thresholds: {
      minReproducibility: 80,
      failOn: ['error', 'warning'],
    },
    bundle: {
      enabled: true,
      includeScreenshots: true,
      compression: 'best',
    },
  };
  
  return JSON.stringify(example, null, 2);
}
