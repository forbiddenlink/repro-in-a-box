# Changelog

All notable changes to repro-in-a-box will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
