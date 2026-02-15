import type { Detector, DetectorConfig } from './base.js';

/**
 * Registry for managing detector instances
 */
export class DetectorRegistry {
  private detectors: Map<string, Detector> = new Map();
  private configs: Map<string, DetectorConfig> = new Map();
  
  /**
   * Register a detector
   */
  register(detector: Detector, config?: DetectorConfig): void {
    if (this.detectors.has(detector.id)) {
      throw new Error(`Detector '${detector.id}' is already registered`);
    }
    
    this.detectors.set(detector.id, detector);
    
    if (config) {
      this.configs.set(detector.id, config);
    }
  }
  
  /**
   * Get a detector by ID
   */
  get(id: string): Detector | undefined {
    return this.detectors.get(id);
  }
  
  /**
   * Get configuration for a detector
   */
  getConfig(id: string): DetectorConfig | undefined {
    return this.configs.get(id);
  }
  
  /**
   * Check if a detector is registered
   */
  has(id: string): boolean {
    return this.detectors.has(id);
  }
  
  /**
   * Get all registered detectors
   */
  getAll(): Detector[] {
    return Array.from(this.detectors.values());
  }
  
  /**
   * Get all enabled detectors
   */
  getEnabled(): Detector[] {
    return this.getAll().filter(detector => {
      const config = this.configs.get(detector.id);
      // If no config or enabled is undefined, detector is enabled by default
      return config?.enabled !== false;
    });
  }
  
  /**
   * Get all detectors with their configurations
   */
  getAllWithConfigs(): Array<{ detector: Detector; config?: DetectorConfig }> {
    return this.getAll().map(detector => ({
      detector,
      config: this.configs.get(detector.id)
    }));
  }
  
  /**
   * List all detector IDs
   */
  list(): string[] {
    return Array.from(this.detectors.keys());
  }
  
  /**
   * Remove a detector
   */
  unregister(id: string): boolean {
    const removed = this.detectors.delete(id);
    this.configs.delete(id);
    return removed;
  }
  
  /**
   * Clear all detectors
   */
  clear(): void {
    this.detectors.clear();
    this.configs.clear();
  }
  
  /**
   * Get the number of registered detectors
   */
  get size(): number {
    return this.detectors.size;
  }
  
  /**
   * Update configuration for a detector
   */
  updateConfig(id: string, config: DetectorConfig): void {
    if (!this.detectors.has(id)) {
      throw new Error(`Detector '${id}' is not registered`);
    }
    
    this.configs.set(id, config);
  }
  
  /**
   * Enable a detector
   */
  enable(id: string): void {
    if (!this.detectors.has(id)) {
      throw new Error(`Detector '${id}' is not registered`);
    }
    
    const config = this.configs.get(id) || {};
    this.configs.set(id, { ...config, enabled: true });
  }
  
  /**
   * Disable a detector
   */
  disable(id: string): void {
    if (!this.detectors.has(id)) {
      throw new Error(`Detector '${id}' is not registered`);
    }
    
    const config = this.configs.get(id) || {};
    this.configs.set(id, { ...config, enabled: false });
  }
}

/**
 * Global registry instance
 */
export const registry = new DetectorRegistry();
