/**
 * Registry for managing detector instances
 */
export class DetectorRegistry {
    detectors = new Map();
    configs = new Map();
    /**
     * Register a detector
     */
    register(detector, config) {
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
    get(id) {
        return this.detectors.get(id);
    }
    /**
     * Get configuration for a detector
     */
    getConfig(id) {
        return this.configs.get(id);
    }
    /**
     * Check if a detector is registered
     */
    has(id) {
        return this.detectors.has(id);
    }
    /**
     * Get all registered detectors
     */
    getAll() {
        return Array.from(this.detectors.values());
    }
    /**
     * Get all enabled detectors
     */
    getEnabled() {
        return this.getAll().filter(detector => {
            const config = this.configs.get(detector.id);
            // If no config or enabled is undefined, detector is enabled by default
            return config?.enabled !== false;
        });
    }
    /**
     * Get all detectors with their configurations
     */
    getAllWithConfigs() {
        return this.getAll().map(detector => ({
            detector,
            config: this.configs.get(detector.id)
        }));
    }
    /**
     * List all detector IDs
     */
    list() {
        return Array.from(this.detectors.keys());
    }
    /**
     * Remove a detector
     */
    unregister(id) {
        const removed = this.detectors.delete(id);
        this.configs.delete(id);
        return removed;
    }
    /**
     * Clear all detectors
     */
    clear() {
        this.detectors.clear();
        this.configs.clear();
    }
    /**
     * Get the number of registered detectors
     */
    get size() {
        return this.detectors.size;
    }
    /**
     * Update configuration for a detector
     */
    updateConfig(id, config) {
        if (!this.detectors.has(id)) {
            throw new Error(`Detector '${id}' is not registered`);
        }
        this.configs.set(id, config);
    }
    /**
     * Enable a detector
     */
    enable(id) {
        if (!this.detectors.has(id)) {
            throw new Error(`Detector '${id}' is not registered`);
        }
        const config = this.configs.get(id) || {};
        this.configs.set(id, { ...config, enabled: true });
    }
    /**
     * Disable a detector
     */
    disable(id) {
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
//# sourceMappingURL=registry.js.map