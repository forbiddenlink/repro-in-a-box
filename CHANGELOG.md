# Changelog

All notable changes to repro-in-a-box will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

See [ROADMAP.md](ROADMAP.md) for planned features in v2.6-v3.0.

### v2.6: Developer Experience (Planned)
- Configuration file support (`.reprorc.json`)
- Interactive setup wizard (`repro init`)
- Multiple output formats (JSON, CSV, HTML, GitHub Actions)
- Enhanced error handling and logging

### v2.7: New Detectors (Planned)
- SEO detector
- Performance detector
- Security detector
- Console warnings detector
- Memory leak detector

### v2.8: Reporting & Visualization (Planned)
- HTML report generator
- Web dashboard
- GitHub Actions integration
- Visual charts and graphs

---

## Links

- [npm package](https://www.npmjs.com/package/repro-in-a-box)
- [GitHub repository](https://github.com/forbiddenlink/repro-in-a-box)
- [Issue tracker](https://github.com/forbiddenlink/repro-in-a-box/issues)
