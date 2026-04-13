# Changelog

All notable changes to repro-in-a-box will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.7.0](https://github.com/forbiddenlink/repro-in-a-box/compare/v2.6.0...v2.7.0) (2026-04-13)


### Features

* add Console Warnings and SEO detectors (v2.7.0) ([46c636d](https://github.com/forbiddenlink/repro-in-a-box/commit/46c636df9d6ae61b88afcc212443483270496c64))
* add Performance detector for render-blocking and large asset detection (v2.8.0) ([6dcb2cc](https://github.com/forbiddenlink/repro-in-a-box/commit/6dcb2cc784d1bb809242d90f7bad6e3d2fd46f2e))
* add professional HTML report generator ([937a4ab](https://github.com/forbiddenlink/repro-in-a-box/commit/937a4ab330e8cfaf3615533813813cc4e6f9d7dc))
* add Security and Memory Leak detectors (v2.9.0) ([3ee584b](https://github.com/forbiddenlink/repro-in-a-box/commit/3ee584bdd871ea94205b6cbd0e6269e15acbe462))
* implement Playwright best practices ([99fc0f8](https://github.com/forbiddenlink/repro-in-a-box/commit/99fc0f88328017c63e254da5c3fa7bb824bcb137))
* reproduction tool updates ([a6a1ee1](https://github.com/forbiddenlink/repro-in-a-box/commit/a6a1ee130fc45786241a4eb299288ae34eff565d))


### Bug Fixes

* add missing chalk dependency ([5320fd7](https://github.com/forbiddenlink/repro-in-a-box/commit/5320fd7b26888d48bfed74059f7b2dbda92762fe))
* **ci:** add --legacy-peer-deps flag to handle eslint peer dependency conflicts ([3e59d97](https://github.com/forbiddenlink/repro-in-a-box/commit/3e59d97e6b4b45868ef28854a27675d08467d0d9))
* improve type safety and reduce ESLint warnings ([54e3e2f](https://github.com/forbiddenlink/repro-in-a-box/commit/54e3e2f55e60bedba937ba80be3871e9ec387928))
* improve TypeScript type safety and ESLint configuration ([34b25ec](https://github.com/forbiddenlink/repro-in-a-box/commit/34b25ec95942efaf50c0cdcee99983df1ff1d809))
* patch 9 security vulnerabilities ([28cd3a6](https://github.com/forbiddenlink/repro-in-a-box/commit/28cd3a6e2b6a348038f11000bb41ea757720a269))
* regenerate package-lock.json for CI ([d47c84c](https://github.com/forbiddenlink/repro-in-a-box/commit/d47c84ca47ea5d91d39b8e0c23a7d4a8a0431611))
* remove conflicting npm overrides (pnpm overrides sufficient) ([2702546](https://github.com/forbiddenlink/repro-in-a-box/commit/27025461010f5bd9e912a2cfab3741c2d9723e84))
* remove dist/ from tracking and add .codacy/ to gitignore ([52e0761](https://github.com/forbiddenlink/repro-in-a-box/commit/52e0761f9ed97c794c83c28e435b329554f4ecd0))
* resolve Web Vitals dynamic import error ([9e71d9d](https://github.com/forbiddenlink/repro-in-a-box/commit/9e71d9daecf87f6981c7f282bbd34a72fb442834))
* switch CI to pnpm, remove stale package-lock.json ([e52a119](https://github.com/forbiddenlink/repro-in-a-box/commit/e52a11917b4e562132df57e2c75c4d2fec3a904b))
* update z.record() to use 2-arg form for Zod v4 compatibility ([b4f83b9](https://github.com/forbiddenlink/repro-in-a-box/commit/b4f83b93c624f93f1b6f0e99c0b655522f4b25e6))

## [Unreleased]

### Added
- **Security Detector** - New detector for security issues:
  - HTTPS enforcement validation
  - Security headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
  - Cookie security flags: Secure, HttpOnly, SameSite
  - Subresource Integrity (SRI) validation for external scripts/stylesheets
- 19 new tests for Security detector
- **Memory Leak Detector** - Detects memory issues:
  - Memory growth patterns over time
  - High baseline memory usage (>200MB)
  - Excessive event listeners
  - Detached DOM node leaks
- 13 new tests for Memory Leak detector
- Total detectors increased to **12**
- Total tests increased to **247**

### Changed
- Fixed 23% of ESLint warnings (73 → 56 warnings) through proper typing
- Improved type safety across multiple detector files

---

## [2.8.0] - 2026-02-25

### Added
- **Performance Detector** - Detects performance issues:
  - Render-blocking scripts (missing `async`/`defer`)
  - Render-blocking stylesheets
  - Large JavaScript files (>250KB)
  - Large CSS files (>100KB)
  - Large images (>500KB)
  - Image optimization suggestions (WebP/AVIF recommendations)

### Changed
- Total detectors increased to 10
- Test suite expanded to 215+ tests

---

## [2.7.0] - 2026-02

### Added
- **Console Warnings Detector** - Detects console warnings separate from errors:
  - Framework-specific warnings (React, Vue, Angular)
  - Deprecation warnings
  - Severity categorization
- **SEO Detector** - Comprehensive SEO analysis:
  - Meta tags (title, description with length validation)
  - Open Graph tags (og:title, og:image, og:description, og:type)
  - Twitter Card tags
  - Structured data (JSON-LD validation)
  - Canonical URLs
  - H1 heading validation (missing/multiple)
  - Viewport and lang attribute checks

### Fixed
- Web Vitals dynamic import error resolved
- TypeScript type safety improvements
- ESLint configuration enhancements

---

## [2.6.0] - 2026-02-16

### 🎉 Major Release: Configuration System

#### Added
- **Configuration System**: Complete configuration file support with validation
  - `.reprorc.json` - JSON configuration file
  - `.reprorc.js` - ES Module configuration file (with dynamic imports)
  - `package.json` - "repro" field for in-package configuration
  - Search order: `.reprorc.json` → `.reprorc.js` → `package.json`
  - Custom config path via `--config <path>` flag

- **Interactive Configuration Wizard** (`repro init`):
  - 11 interactive prompts for complete configuration
  - Detector selection (checkbox multi-select)
  - Crawler settings (depth, pages, rate limiting)
  - Browser configuration (headless mode, screenshots)
  - Output preferences (format, directory, reporting)
  - Thresholds (warning/error counts)
  - Bundle analysis settings
  - Output formats: `--output <path>` (default: .reprorc.json), `--js` for .reprorc.js

- **Configuration Sections** (6 major sections):
  - `detectors`: Enable/disable specific detectors, filter by type
  - `crawler`: Max depth, max pages, rate limiting, same-origin policy
  - `browser`: Headless mode, viewport size, screenshots, user agent
  - `output`: Format (json/html/both), directory, reporting options
  - `thresholds`: Warning/error counts for exit codes
  - `bundle`: Bundle analysis, chunk size threshold, size warnings

- **Config Priority System**: CLI flags > Config file > Defaults
  - CLI flags always override config file settings
  - Config file overrides default values
  - Mix and match: set base config in file, override for specific runs

- **Detector Filtering**: 
  - Enable only specific detectors via `config.detectors.enabled`
  - Disable specific detectors via `config.detectors.disabled`
  - Reduces overhead when you only need certain checks

- **Comprehensive Documentation**:
  - 250+ lines of configuration documentation in README
  - 3 complete config file examples (.json, .js, package.json)
  - Real-world usage scenarios (CI/CD, local dev, production)
  - All 6 config sections fully documented
  - Mix-and-match examples showing CLI override behavior

#### Fixed
- **Detector ID Consistency**: Standardized detector IDs across codebase
  - Schema now uses `javascript-errors` (not `js-errors`) matching implementation
  - All 7 detector IDs unified: `javascript-errors`, `network-errors`, `broken-assets`, `accessibility`, `web-vitals`, `mixed-content`, `broken-links`
  - Init command prompts updated to match schema

- **Output Directory Creation**: Automatically creates output directory if it doesn't exist
  - Previously failed with ENOENT when `repro-results/` didn't exist
  - Now uses `mkdirSync(outputDir, { recursive: true })`

#### Changed
- **Type System**: Added `FullReproConfig` type for merged configs
  - Guarantees all nested config objects are present after merging
  - Eliminates TypeScript "possibly undefined" errors
  - `mergeConfigs()` returns `FullReproConfig` with complete structure

- **Test Suite**: 111 tests (up from 105)
  - Added 9 new config system tests
  - Tests cover validation, defaults, merging, priority system
  - All existing tests passing with no regressions

#### Dependencies
- **Zod 3.25.76**: Schema validation for configuration files
- **Inquirer 9.3.8**: Interactive CLI prompts for init wizard

#### Performance
- Config loading: <10ms for .json files
- Config validation: <5ms with Zod
- No impact on scan performance (config loaded once at startup)

#### Documentation
- See **"⚙️ Configuration"** section in [README.md](README.md) for complete documentation
- Quick start: Run `repro init` to create your first config file
- Examples for .reprorc.json, .reprorc.js, and package.json configurations
- Real-world usage patterns for different environments

---

## [2.5.1] - 2026-02-15

### 🐛 Critical Bug Fix

#### Fixed
- **Missing Runtime Dependency**: Moved `@playwright/test` from devDependencies to dependencies
  - Package was broken on install due to missing peer dependency
  - All source files import from `@playwright/test` for Page, Browser types
  - This fix makes the package actually work when installed via npm

**Impact**: v2.5.0 was non-functional when installed. All users should upgrade to v2.5.1 immediately.

---

## [2.5.0] - 2026-02-15

### 🎉 Major Release: Production-Grade Testing & Quality

#### Added
- **Comprehensive Test Suite**: 112+ tests across 7 test files (5x increase from 22)
- **CLI Command Tests** (22 tests): Full coverage of scan, validate, and diff commands
- **Detector Edge Cases** (22 tests): Edge case coverage for all 7 detectors
- **Performance Benchmarks** (9 benchmarks): Baseline metrics for detector performance
- **MCP Tool Tests**: Expanded from 2 → 35 tests covering all MCP tools
- **Test Coverage Configuration**: Excludes non-production code for accurate reporting

#### Changed
- **Package Version**: 2.0.0 → 2.5.0
- **README**: Updated with test statistics, badges, and coverage information
- **Test Statistics**: 1,397 lines of test code, ~85% code coverage
- **Documentation**: Enhanced with comprehensive enhancement summary

#### Fixed
- **Security Vulnerabilities**: Resolved 2 high-severity Playwright SSL issues
- **Dev Dependencies**: Documented 6 moderate vulnerabilities in dev-only dependencies (acceptable)

#### Performance
- Detector attach: <100ms
- Detector collect: <500ms  
- Handle 100 issues: <1s

#### Documentation
- Added [ENHANCEMENT_SUMMARY.md](ENHANCEMENT_SUMMARY.md) with detailed v2.5.0 improvements
- Updated README with test statistics and development section
- Enhanced package description with testing highlights

### Test Files Added
- `tests/cli.test.ts` - 22 CLI command tests
- `tests/detector-edge-cases.test.ts` - 22 edge case tests
- `tests/performance.test.ts` - 9 performance benchmarks

### Test Files Enhanced
- `tests/detectors.test.ts` - Added Mixed Content and Broken Links detector tests
- `tests/integration/mcp-server.test.ts` - Expanded to 35 comprehensive MCP tests

---

## [2.0.0] - 2026-02-14

### 🎉 Major Release: Full Feature Set Complete

#### Added
- **7 Built-in Detectors**: 
  - JavaScript Errors detector
  - Network Errors detector
  - Broken Assets detector
  - Accessibility detector (WCAG 2.1)
  - Web Vitals detector
  - Mixed Content detector
  - Broken Links detector
- **Multi-Page Crawler**: Configurable depth, rate limiting, same-domain filtering
- **Auto-Bundling**: ZIP packages with HAR files, screenshots, and reproduction scripts
- **HAR Replay**: Validates reproducibility by replaying network traffic 3x
- **Diff Comparison**: Compare scan results across runs
- **MCP Server**: Claude Desktop integration with 3 tools (scan_site, validate_reproduction, diff_scans)
- **CLI Commands**: `scan`, `validate`, `diff`
- **Initial Test Suite**: 22 tests with Vitest

#### Features
- Detector framework with lifecycle hooks
- Detector registry for plugin management
- Screenshot capture on issue detection
- Reproducibility scoring (0-100%)
- Consistency analysis across replay runs
- HAR recording during scans
- JSON output for all commands

#### Documentation
- Comprehensive README with examples
- BUILD_CHECKLIST.md for implementation guide
- TECHNICAL_SPEC.md for architecture details
- MCP integration examples

---

## [1.0.0] - 2026-01-15

### Initial Release

#### Added
- Basic project structure
- TypeScript configuration
- Playwright integration
- Commander CLI framework
- Initial detector interface

---

## Upcoming

See [ROADMAP.md](ROADMAP.md) for planned features in v2.9-v3.0.

### v2.9: Plugin System (Planned)
- Custom detector interface
- Plugin discovery from `node_modules/repro-plugin-*`
- Plugin registry for NPM packages
- Plugin lifecycle hooks

### v3.0: Enterprise Features (Planned)
- Scheduled scanning with cron support
- Historical tracking in SQLite database
- Webhooks and notifications (Slack, Discord, email)
- REST/GraphQL API server
- CI/CD integrations (GitHub Actions, GitLab CI)

---

## Links

- [npm package](https://www.npmjs.com/package/repro-in-a-box)
- [GitHub repository](https://github.com/forbiddenlink/repro-in-a-box)
- [Issue tracker](https://github.com/forbiddenlink/repro-in-a-box/issues)
