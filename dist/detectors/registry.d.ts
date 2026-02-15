import type { Detector, DetectorConfig } from './base.js';
/**
 * Registry for managing detector instances
 */
export declare class DetectorRegistry {
    private detectors;
    private configs;
    /**
     * Register a detector
     */
    register(detector: Detector, config?: DetectorConfig): void;
    /**
     * Get a detector by ID
     */
    get(id: string): Detector | undefined;
    /**
     * Get configuration for a detector
     */
    getConfig(id: string): DetectorConfig | undefined;
    /**
     * Check if a detector is registered
     */
    has(id: string): boolean;
    /**
     * Get all registered detectors
     */
    getAll(): Detector[];
    /**
     * Get all enabled detectors
     */
    getEnabled(): Detector[];
    /**
     * Get all detectors with their configurations
     */
    getAllWithConfigs(): Array<{
        detector: Detector;
        config?: DetectorConfig;
    }>;
    /**
     * List all detector IDs
     */
    list(): string[];
    /**
     * Remove a detector
     */
    unregister(id: string): boolean;
    /**
     * Clear all detectors
     */
    clear(): void;
    /**
     * Get the number of registered detectors
     */
    get size(): number;
    /**
     * Update configuration for a detector
     */
    updateConfig(id: string, config: DetectorConfig): void;
    /**
     * Enable a detector
     */
    enable(id: string): void;
    /**
     * Disable a detector
     */
    disable(id: string): void;
}
/**
 * Global registry instance
 */
export declare const registry: DetectorRegistry;
//# sourceMappingURL=registry.d.ts.map