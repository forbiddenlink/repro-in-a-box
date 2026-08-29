import { BaseDetector, IssueCategory, IssueSeverity } from '../../../src/detectors/base.js';

class ExamplePluginDetector extends BaseDetector {
  readonly id = 'example-plugin';
  readonly name = 'Example Plugin';
  readonly description = 'Fixture detector used in plugin-loader tests';
  readonly category = IssueCategory.CUSTOM;

  attach(): Promise<void> {
    return Promise.resolve();
  }

  async scan(page: { url(): string; title(): Promise<string> }) {
    const title = await page.title();
    if (title.includes('plugin-fixture')) {
      this.addIssue(this.createIssue(
        'example-plugin-hit',
        'Example plugin matched the page title',
        IssueSeverity.INFO,
        page.url()
      ));
    }
    return this.issues;
  }
}

let beforeScanCount = 0;

export default {
  name: 'repro-plugin-example',
  version: '1.0.0',
  detectors: [new ExamplePluginDetector()],
  hooks: {
    beforeScan() {
      beforeScanCount += 1;
    },
  },
};

export function getBeforeScanCount(): number {
  return beforeScanCount;
}
