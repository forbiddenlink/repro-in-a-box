import { describe, it, expect } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { fileURLToPath } from 'url';
import { createScanRegistry, loadPlugins } from '../../src/plugins/loader.js';
import { DETECTOR_IDS } from '../../src/detectors/catalog.js';

const fixtureDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures/repro-plugin-example');

describe('plugin loader', () => {
  it('loads a local plugin path and registers its detector', async () => {
    const { registry, plugins } = await createScanRegistry({
      enabled: ['js-errors', 'example-plugin'],
      plugins: {
        paths: [fixtureDir],
        autoDiscover: false,
      },
    });

    expect(plugins).toHaveLength(1);
    expect(plugins[0].name).toBe('repro-plugin-example');
    expect(registry.has('js-errors')).toBe(true);
    expect(registry.has('example-plugin')).toBe(true);
    expect(registry.size).toBe(2);
  });

  it('rejects plugin detector ids that collide with builtins', async () => {
    const colliding = path.join(os.tmpdir(), `repro-collide-${Date.now()}.mjs`);
    fs.writeFileSync(colliding, `
      export default {
        name: 'collide',
        detectors: [{
          id: 'js-errors',
          name: 'Fake',
          description: 'nope',
          category: 'javascript',
          attach: async () => {},
          collect: async () => ({ detector: 'js-errors', url: '', startTime: 0, endTime: 0, duration: 0, issues: [] }),
        }],
      };
    `);

    await expect(createScanRegistry({
      plugins: { paths: [colliding], autoDiscover: false },
      cwd: os.tmpdir(),
    })).rejects.toThrow(/collides with an existing detector/);
  });

  it('throws for unknown enabled ids after plugins load', async () => {
    await expect(createScanRegistry({
      enabled: ['not-a-real-detector'],
      plugins: { autoDiscover: false },
    })).rejects.toThrow(/Unknown detector/);
  });

  it('does not auto-register plugin detectors that were not requested', async () => {
    const { registry } = await createScanRegistry({
      enabled: ['js-errors'],
      plugins: {
        paths: [fixtureDir],
        autoDiscover: false,
      },
    });

    expect(registry.has('example-plugin')).toBe(false);
    expect(registry.list()).toEqual(['js-errors']);
  });

  it('discovers repro-plugin-* packages in node_modules', async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'repro-nm-'));
    const pluginDir = path.join(cwd, 'node_modules', 'repro-plugin-nm-fixture');
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(path.join(pluginDir, 'package.json'), JSON.stringify({
      name: 'repro-plugin-nm-fixture',
      type: 'module',
      main: 'index.js',
    }));
    fs.writeFileSync(path.join(pluginDir, 'index.js'), `
      export default {
        name: 'repro-plugin-nm-fixture',
        detectors: [{
          id: 'nm-fixture',
          name: 'NM Fixture',
          description: 'from node_modules',
          category: 'custom',
          attach: async () => {},
          collect: async () => ({ detector: 'nm-fixture', url: '', startTime: 0, endTime: 0, duration: 0, issues: [] }),
        }],
      };
    `);

    const plugins = await loadPlugins({ cwd, autoDiscover: true });
    expect(plugins.map((p) => p.name)).toContain('repro-plugin-nm-fixture');
    expect(plugins[0].detectors[0].id).toBe('nm-fixture');
  });

  it('still registers all builtins when no plugins are present', async () => {
    const { registry, plugins } = await createScanRegistry({
      plugins: { autoDiscover: false },
    });
    expect(plugins).toHaveLength(0);
    expect(registry.size).toBe(DETECTOR_IDS.length);
  });
});
