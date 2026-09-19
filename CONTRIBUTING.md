# Contributing to Repro-in-a-Box

Thank you for your interest in contributing! This guide will help you get started.

## 🚀 Quick Start

1. **Fork & Clone**
   ```bash
   git clone https://github.com/YOUR_USERNAME/repro-in-a-box.git
   cd repro-in-a-box
   ```

2. **Install Dependencies**
   ```bash
   pnpm install
   npx playwright install chromium
   ```

3. **Build & Test**
   ```bash
   pnpm run build
   pnpm run test:run
   ```

4. **Run Locally**
   ```bash
   pnpm run dev -- scan https://example.com
   ```

---

## 📋 Ways to Contribute

### 🐛 Bug Reports
- Check [existing issues](https://github.com/forbiddenlink/repro-in-a-box/issues) first
- Provide repro steps, expected vs. actual behavior
- Include version: `npx repro-in-a-box --version`
- Share scan results if relevant

### ✨ Feature Requests
- Check [ROADMAP.md](ROADMAP.md) for planned features
- Open an issue with your proposal
- Explain the use case and benefits
- Consider implementing it yourself!

### 🔧 Code Contributions
- See "Development Workflow" below
- Follow code style guidelines
- Add tests for new features
- Update documentation

### 📚 Documentation
- Fix typos, improve clarity
- Add examples and tutorials
- Create video demos
- Translate to other languages

---

## 💻 Development Workflow

### 1. Create a Branch
```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-number-description
```

### 2. Make Changes
- Keep commits focused and atomic
- Write clear commit messages
- Follow existing code patterns

### 3. Add Tests
```bash
# Run tests in watch mode
pnpm test

# Run specific test file
pnpm test -- tests/your-test.test.ts

# Check coverage
pnpm run test:run -- --coverage
```

**Test Requirements:**
- New detectors: 5+ tests (setup, collect, edge cases)
- New features: 80%+ coverage
- Bug fixes: Add regression test

### 4. Run Quality Checks
```bash
# Type check
npx tsc --noEmit

# Build (catch any TS errors)
pnpm run build

# Run all tests
pnpm run test:run
```

### 5. Commit & Push
```bash
git add .
git commit -m "feat: add SEO detector with meta tag validation"
git push origin feature/your-feature-name
```

### 6. Open Pull Request
- Link related issue(s)
- Describe what changed and why
- Include screenshots/examples if relevant
- Check that CI passes

---

## 🎯 Priority Features

Looking for something to work on? See [ROADMAP.md](ROADMAP.md) for the current per-feature
checkbox status (most early items above are already shipped; the file tracks what's actually
still open).

---

## 📝 Code Style Guidelines

### TypeScript
- Use explicit types (avoid `any`)
- Prefer interfaces over type aliases
- Use async/await over promises
- Follow existing naming conventions

### File Structure
```typescript
// 1. Imports (external, then internal)
import { Page } from 'playwright';
import { Detector, DetectionResult } from './base.js';

// 2. Types/Interfaces
export interface MyDetectorOptions {
  threshold: number;
}

// 3. Class/Function
export class MyDetector implements Detector {
  // ...
}

// 4. Exports
export default MyDetector;
```

### Detectors
All detectors must extend `BaseDetector` (or implement `Detector`). See [docs/guides/plugins.md](docs/guides/plugins.md) to ship a `repro-plugin-*` package.

```typescript
export interface Detector {
  name: string;
  description: string;
  category: 'error' | 'performance' | 'accessibility' | 'seo' | 'security';
  
  setup(page: Page): Promise<void>;
  collect(page: Page): Promise<DetectionResult>;
  teardown?(page: Page): Promise<void>;
}
```

**Best Practices:**
- Use descriptive issue messages
- Include context (URL, element selector, etc.)
- Provide severity levels (error, warning, info)
- Document detector options
- Add examples to README

### Tests
- Use descriptive test names
- Group related tests with `describe()`
- Use `beforeEach()` for setup
- Clean up resources in `afterEach()`
- Mock external dependencies

```typescript
describe('MyDetector', () => {
  let detector: MyDetector;
  let page: Page;

  beforeEach(async () => {
    detector = new MyDetector();
    page = await browser.newPage();
  });

  afterEach(async () => {
    await page.close();
  });

  test('should detect issues', async () => {
    await detector.setup(page);
    const result = await detector.collect(page);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});
```

---

## 🏗️ Project Architecture

```
src/
├── detectors/           # Issue detection plugins
│   ├── base.ts          # Base detector interface
│   ├── registry.ts      # Detector management
│   └── *.ts             # Individual detectors
├── cli/                 # Command-line interface
│   ├── index.ts         # CLI entry point
│   └── commands/        # scan, validate, diff
├── crawler/             # Multi-page crawling
├── bundler/             # ZIP package creation
├── determinism/         # HAR replay & validation
├── mcp/                 # MCP server (Claude integration)
└── scanner/             # Main scanning orchestration

tests/
├── *.test.ts                     # unit tests, mirror src/ structure
└── integration/                  # full scan workflow, MCP tool validation
```

---

## 🔍 Adding a New Detector

### 1. Create Detector File
```typescript
// src/detectors/my-detector.ts
import { Page } from 'playwright';
import { BaseDetector, DetectionResult } from './base.js';

export class MyDetector extends BaseDetector {
  name = 'my-detector';
  description = 'Detects my specific issue type';
  category = 'performance' as const;

  async setup(page: Page): Promise<void> {
    // Initialize detector (e.g., add listeners)
  }

  async collect(page: Page): Promise<DetectionResult> {
    // Collect and return issues
    return {
      detectorName: this.name,
      url: page.url(),
      issues: [],
      metadata: {}
    };
  }
}
```

### 2. Register Detector
```typescript
// src/detectors/index.ts
import { MyDetector } from './my-detector.js';

export function registerAllDetectors() {
  registry.register(new MyDetector());
  // ... other detectors
}
```

### 3. Add Tests
```typescript
// tests/detectors.test.ts
describe('My Detector', () => {
  test('should detect specific issues', async () => {
    const detector = new MyDetector();
    // ... test implementation
  });
});
```

### 4. Update Documentation
- Add to README.md detector list
- Add usage examples

---

## 📦 Release Process

Releases are automated by [release-please](.github/workflows/release-please.yml): it opens a
release PR that bumps the version and updates CHANGELOG.md from conventional commit messages.
Merging that PR creates the GitHub release and tag. Maintainers do not run `npm version`
manually; publishing to npm (if not automated) is `pnpm publish` after the release PR merges.

---

## 🤝 Community

- **GitHub Discussions**: Ask questions, share ideas
- **Issues**: Bug reports and feature requests
- **Pull Requests**: Code contributions
- **Twitter**: Share your scans with #ReproInABox

---

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

## ❓ Questions?

- Check the [README](README.md) and [CLAUDE.md](CLAUDE.md)
- Browse [existing issues](https://github.com/forbiddenlink/repro-in-a-box/issues)
- Open a [new discussion](https://github.com/forbiddenlink/repro-in-a-box/discussions)

**Happy contributing! 🎉**
