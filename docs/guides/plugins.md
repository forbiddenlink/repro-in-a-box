# Writing Repro plugins

Custom detectors are npm packages (or local modules) that export a `ReproPlugin`. Built-in detectors stay in core; plugins are how you add product-specific checks without forking.

## Plugin shape

```ts
import {
  BaseDetector,
  IssueCategory,
  IssueSeverity,
  type ReproPlugin,
} from 'repro-in-a-box';

class MissingTestIdDetector extends BaseDetector {
  readonly id = 'missing-testid';
  readonly name = 'Missing test ids';
  readonly description = 'Flags interactive elements without data-testid';
  readonly category = IssueCategory.CUSTOM;

  async attach() {}

  async scan(page) {
    const missing = await page.$$eval('button,a[href],input', (els) =>
      els.filter((el) => !el.getAttribute('data-testid')).length
    );
    if (missing > 0) {
      this.addIssue(this.createIssue(
        'missing-testid',
        `${missing} interactive element(s) lack data-testid`,
        IssueSeverity.WARNING,
        page.url()
      ));
    }
    return this.issues;
  }
}

const plugin: ReproPlugin = {
  name: 'repro-plugin-testid',
  version: '1.0.0',
  detectors: [new MissingTestIdDetector()],
  hooks: {
    beforeScan(ctx) {
      console.error(`[testid] scanning ${ctx.url}`);
    },
    afterScan(ctx) {
      console.error(`[testid] issues: ${ctx.results.summary.totalIssues}`);
    },
    onError(error) {
      console.error(`[testid] ${error.message}`);
    },
  },
};

export default plugin;
```

Publish as `repro-plugin-<name>` (or `@scope/repro-plugin-<name>`) so auto-discovery finds it.

## Load it

```json
{
  "plugins": {
    "packages": ["repro-plugin-testid"],
    "paths": ["./plugins/my-local-check.js"],
    "autoDiscover": true
  }
}
```

- `packages` — already-installed npm modules (Repro does not install them for you)
- `paths` — files or directories under the project root (path traversal is rejected)
- `autoDiscover` — default `true`; loads every `repro-plugin-*` package in `node_modules`

Enable a plugin detector like any other:

```bash
repro scan https://example.com
# or restrict:
```

```json
{
  "detectors": {
    "enabled": ["js-errors", "missing-testid"]
  }
}
```

Detector ids must be unique. A plugin cannot reuse a built-in id such as `js-errors`.

## Lifecycle hooks

| Hook | When |
|------|------|
| `beforeScan` | After registry setup, before the browser launches |
| `afterScan` | After results are summarized, before they are returned |
| `onError` | If the scan or another hook throws |

Hooks run in plugin-load order. An `onError` throw is swallowed so it cannot hide the original failure.
