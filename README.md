# Repro-in-a-Box v2.6 🎁

**Find bugs. Freeze them. Ship them.**

Autonomous QA agent that finds bugs on your site, captures reproducible evidence (HAR files + screenshots), validates reproducibility, and provides Claude Desktop integration via MCP.

[![Version](https://img.shields.io/badge/version-2.6.0-blue)](https://github.com/forbiddenlink/repro-in-a-box)
[![Tests](https://img.shields.io/badge/tests-119-green)]()
[![Coverage](https://img.shields.io/badge/coverage-85%25-brightgreen)]()
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

## ✨ Features

- **7 Built-in Detectors**: JavaScript errors, network failures, broken assets, accessibility (WCAG 2.1), web vitals, mixed content, broken links
- **Production-Grade Testing**: 119 tests across 9 test files, ~85% code coverage
- **Performance Benchmarked**: <100ms detector attach, <500ms collect, <1s for 100 issues
- **Multi-Page Crawler**: Configurable depth, rate limiting, same-domain filtering
- **Auto-Bundling**: Creates reproducible ZIP packages with HAR files and screenshots
- **HTML Reports**: Professional, modern HTML reports with interactive tables and visual distributions
- **HAR Replay**: Validates reproducibility by replaying network traffic 3x
- **Diff Comparison**: Compare scan results across runs
- **MCP Server**: Claude Desktop integration for AI-powered bug hunting

## 🚀 Quick Start

```bash
# Install
npm install

# Build
npm run build

# Create config file (optional but recommended)
repro init

# Scan a website and create reproducible bundle
repro scan https://your-site.com --bundle

# Validate reproducibility
repro validate repro-your-site-com-*.zip

# Compare two scans
repro diff scan-results-1.json scan-results-2.json

# Start MCP server (for Claude Desktop)
npm run mcp
```

## 📦 What's in the Box

### ✅ Week 1-5: Complete Implementation

#### 7 Working Detectors

1. **JavaScript Errors** (`js-errors`)
   - Console errors and warnings
   - Uncaught exceptions
   - Unhandled promise rejections
   - Full stack traces

2. **Network Errors** (`network-errors`)
   - Failed HTTP requests (4xx, 5xx)
   - Timeouts and DNS failures
   - Connection errors
   - Request/response details

3. **Broken Assets** (`broken-assets`)
   - Missing images, scripts, stylesheets
   - Failed fonts and media
   - Any resource with HTTP ≥400

4. **Accessibility** (`accessibility`)
   - WCAG 2.1 Level A & AA via axe-core
   - Missing alt text
   - Color contrast issues
   - Form label violations
   - Landmark structure problems

5. **Web Vitals** (`web-vitals`)
   - Core Web Vitals (CLS, INP, LCP)
   - FCP, TTFB measurements
   - Performance thresholds
   - Only reports issues (<75th percentile)

6. **Mixed Content** (`mixed-content`)
   - HTTP resources on HTTPS pages
   - Active/passive mixed content
   - Security downgrade detection

7. **Broken Links** (`broken-links`)
   - Checks all links on page
   - HTTP 4xx/5xx detection
   - Network failure tracking
   - HEAD request optimization

#### Auto-Bundling (Week 2)

- Creates ZIP bundles with:
  - Scan results JSON
  - HAR file (full network recording)
  - Screenshots of issues
  - Reproduction script
  - Setup README
- One command to create reproducible packages
- Bundle size: typically 100-500KB

#### HAR Replay & Validation (Week 3-4)

- Replays HAR files using Playwright's `routeFromHAR`
- Runs scans 3x to validate reproducibility
- Calculates reproducibility score (0-100%)
- Detailed diff analysis
- Consistency tracking (always/never/sometimes present)

#### MCP Server (Week 5)

- stdio transport for Claude Desktop
- Three tools:
  - `scan_site`: Scan and bundle websites
  - `validate_reproduction`: Validate HAR replay
  - `diff_scans`: Compare scan results
- Ready for AI-powered bug hunting

## 📋 Commands

### `scan` - Detect issues and create bundles

```bash
repro scan <url> [options]

Options:
  -d, --max-depth <number>    Maximum crawl depth (default: 2)
  -p, --max-pages <number>    Maximum pages to scan (default: 10)
  -r, --rate-limit <ms>       Rate limit between requests (default: 1000)
  -o, --output <path>         Output path for results
  -f, --format <type>         Output format: json, html (default: json)
  --bundle                    Create reproducible ZIP bundle (includes HAR + screenshots)
  --screenshots               Capture screenshots when issues detected  
  --record-har                Record HAR file during scan
  --no-headless               Run browser in visible mode
  --same-domain-only          Only crawl pages on the same domain (default: true)
```

Examples:
```bash
# Quick scan with bundle
repro scan https://example.com --max-pages 1 --bundle

# Generate professional HTML report
repro scan https://example.com --format html -o report.html

# Deep scan (multiple pages)
repro scan https://example.com --max-pages 50 --max-depth 3 --bundle

# Scan without bundling
repro scan https://example.com --output ./scan-results.json

# Watch the browser
repro scan https://example.com --no-headless --bundle
```

### `validate` - Verify reproducibility via HAR replay

```bash
repro validate <bundle.zip> [options]

Options:
  -r, --runs <number>         Number of replay runs (default: 3)
  -t, --threshold <percent>   Minimum reproducibility score (default: 70)
  -o, --output <dir>          Output directory for extracted bundle
  -v, --verbose               Show detailed diff and consistency analysis
  --json                      Output results as JSON
```

Examples:
```bash
# Validate a bundle (3 runs, 70% threshold)
repro validate repro-example-com-2026-02-15.zip

# Verbose output with 5 runs
repro validate repro-example-com-2026-02-15.zip --runs 5 --verbose

# Strict validation (90% threshold)
repro validate repro-example-com-2026-02-15.zip --threshold 90

# JSON output for parsing
repro validate repro-example-com-2026-02-15.zip --json > validation-results.json
```

Output:
```
🔍 Validating reproducibility...

📊 Original Scan
   URL: https://example.com
   Issues: 2

🔄 Replay Runs
   Run 1: ✅ Success - 2 issues found
   Run 2: ✅ Success - 2 issues found  
   Run 3: ✅ Success - 2 issues found

📈 Summary
   Total runs: 3
   Successful: 3/3
   Average issues: 2.0

🎯 Reproducibility Score
   100.0%

   Grade: 🥇 Excellent
```

### `diff` - Compare scan results

```bash
repro diff <baseline.json> <comparison.json>
```

Coming soon: Full CLI implementation (currently available via MCP).
## ⚙️ Configuration

Repro-in-a-Box supports configuration files to set default values for all options. This eliminates the need to pass the same flags repeatedly.

### Quick Start

Create a configuration file interactively:

```bash
repro init
```

This wizard will ask you questions and generate a `.reprorc.json` file with your preferences.

### Configuration Files

Repro-in-a-Box searches for configuration in this order:

1. `--config <path>` flag (if specified)
2. `.reprorc.json` in current directory
3. `.reprorc.js` in current directory (JavaScript module)
4. `repro` field in `package.json`

**Priority**: CLI flags > Config file > Defaults

### Example: `.reprorc.json`

```json
{
  "detectors": {
    "enabled": ["javascript-errors", "network-errors", "broken-assets"],
    "disabled": ["web-vitals"]
  },
  "crawler": {
    "maxDepth": 3,
    "maxPages": 100,
    "rateLimit": 100,
    "sameDomain": true,
    "followRedirects": true
  },
  "browser": {
    "headless": true,
    "slowMo": 0,
    "timeout": 30000
  },
  "output": {
    "format": "json",
    "path": "./repro-results",
    "verbose": false
  },
  "thresholds": {
    "minReproducibility": 70,
    "failOn": ["error"]
  },
  "bundle": {
    "enabled": true,
    "includeScreenshots": true,
    "includeHar": true,
    "compression": "fast"
  }
}
```

### Example: `.reprorc.js` (JavaScript)

```javascript
export default {
  crawler: {
    maxDepth: 5,
    maxPages: 50,
  },
  detectors: {
    // Only run these detectors
    enabled: ['javascript-errors', 'accessibility'],
  },
  bundle: {
    enabled: true,
  },
};
```

### Example: `package.json`

```json
{
  "name": "my-project",
  "repro": {
    "crawler": {
      "maxDepth": 2,
      "maxPages": 20
    },
    "bundle": {
      "enabled": true
    }
  }
}
```

### Configuration Options

#### Detectors

```json
{
  "detectors": {
    "enabled": [
      "javascript-errors",    // Console errors, exceptions
      "network-errors",       // Failed HTTP requests
      "broken-assets",        // Missing images, scripts
      "accessibility",        // WCAG 2.1 violations
      "web-vitals",          // Core Web Vitals
      "mixed-content",       // HTTP on HTTPS
      "broken-links"         // Check all links
    ],
    "disabled": []  // Disable specific detectors
  }
}
```

**Note**: If `enabled` is empty or not specified, all detectors run. Use `disabled` to exclude specific ones.

#### Crawler

```json
{
  "crawler": {
    "maxDepth": 3,          // How many clicks deep (1-10)
    "maxPages": 100,        // Maximum pages to scan (1-1000)
    "rateLimit": 100,       // Delay between requests in ms (0-10000)
    "sameDomain": true,     // Only crawl same domain
    "followRedirects": true // Follow HTTP redirects
  }
}
```

#### Browser

```json
{
  "browser": {
    "headless": true,       // Run browser in background
    "slowMo": 0,           // Slow down operations (ms)
    "timeout": 30000,      // Page load timeout (ms)
    "userAgent": "..."     // Custom user agent (optional)
  }
}
```

#### Output

```json
{
  "output": {
    "format": "json",      // json | text | csv | html
    "path": "./repro-results",  // Output directory
    "verbose": false,      // Detailed logging
    "quiet": false         // Suppress output except errors
  }
}
```

#### Thresholds

```json
{
  "thresholds": {
    "minReproducibility": 70,  // Min score to pass (0-100)
    "maxIssues": null,         // Max issues before failing
    "failOn": ["error"]        // Fail on: error | warning | info
  }
}
```

#### Bundle

```json
{
  "bundle": {
    "enabled": false,           // Create ZIP bundles
    "includeScreenshots": true, // Include issue screenshots
    "includeHar": true,         // Include HAR file
    "compression": "fast"       // none | fast | best
  }
}
```

### Using Configurations

#### 1. With `.reprorc.json` in project

```bash
# Uses .reprorc.json settings
repro scan https://example.com

# CLI flags override config
repro scan https://example.com --max-depth 5
```

#### 2. With custom config path

```bash
repro scan https://example.com --config ./configs/prod.json
```

#### 3. Mix and match

```bash
# Config: maxDepth=3, maxPages=100, bundle=true
# CLI overrides maxPages to 20
repro scan https://example.com --max-pages 20
```

### Real-World Examples

**CI/CD Pipeline** (`.reprorc.json`):
```json
{
  "crawler": { "maxPages": 50, "rateLimit": 0 },
  "thresholds": { "minReproducibility": 80, "failOn": ["error", "warning"] },
  "bundle": { "enabled": true }
}
```

**Local Development**:
```bash
repro scan https://localhost:3000 --no-headless --max-pages 5
```

**Production Monitoring** (`repro-prod.json`):
```json
{
  "detectors": {
    "enabled": ["javascript-errors", "network-errors", "accessibility"]
  },
  "crawler": { "maxDepth": 5, "maxPages": 200 },
  "thresholds": { "failOn": ["error"] }
}
```

```bash
repro scan https://prod.example.com --config repro-prod.json
```
## � MCP Server Integration

Repro-in-a-Box includes an MCP server for Claude Desktop integration.

### Setup

1. Build the project:
```bash
npm run build
```

2. Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):
```json
{
  "mcpServers": {
    "repro-in-a-box": {
      "command": "node",
      "args": ["/absolute/path/to/repro-in-a-box/dist/mcp/index.js"]
    }
  }
}
```

3. Restart Claude Desktop

4. Verify it's working:
   - Ask Claude: "What tools do you have?"
   - You should see: `scan_site`, `validate_reproduction`, `diff_scans`

### Using with Claude

Ask Claude to scan websites:
```
"Scan https://example.com for bugs and create a reproducible bundle"
```

Validate reproducibility:
```
"Validate the reproducibility of repro-example-com-2026-02-15.zip"
```

Compare scans:
```
"Compare scan-results-1.json with scan-results-2.json"
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Run tests in watch mode
npm test -- --watch

# Generate coverage report
npm test -- --coverage
```

Current test coverage:
- ✅ Diff utility: 10 tests passing
- ✅ Detector registry: 5 tests passing
- ✅ 15 total tests passing

## 📊 Example Output

### Scan Output

```
🔍 Repro-in-a-Box Scanner
========================

URL: https://example.com
Max Depth: 2
Max Pages: 10
Bundle: Yes (includes HAR + screenshots)

📦 Registered detectors:
  - JavaScript Errors (js-errors)
  - Network Errors (network-errors)
  - Broken Assets (broken-assets)
  - Accessibility (accessibility)
  - Web Vitals (web-vitals)
  - Mixed Content (mixed-content)
  - Broken Links (broken-links)

🚀 Starting scan...

📄 Scanning: https://example.com/
  ⚠️  Found 2 issue(s)

📊 Scan Results
===============

Pages scanned: 1
Total issues: 2
Duration: 3.27s

Issues by severity:
  error: 2

Issues by category:
  accessibility: 2

💾 Results saved to: scan-results.json

📦 Creating reproducible bundle...

✅ Bundle created: repro-example-com-2026-02-15-16-03-28.zip
   Size: 20.77 KB
   Contents: 6 files

   To reproduce:
   unzip repro-example-com-2026-02-15-16-03-28.zip
   chmod +x reproduce.sh
   ./reproduce.sh
```

## 🗺️ Roadmap

### ✅ Week 1: Foundation (Complete)
- [x] Detector framework with lifecycle hooks
- [x] 7 core detectors (JS errors, network, assets, accessibility, web vitals, mixed content, broken links)
- [x] CLI framework with Commander
- [x] Multi-page crawler with rate limiting

### ✅ Week 2: Auto-Bundling (Complete)
- [x] ZIP creation with HAR + scan results
- [x] Screenshot capture on issues
- [x] Reproduction script generation
- [x] Bundle README generation

### ✅ Week 3-4: Determinism Engine (Complete)
- [x] HAR recording during scan
- [x] HAR replay validation (3x runs)
- [x] Reproducibility scoring (0-100%)
- [x] Diff utility for comparing scans
- [x] Consistency analysis
- [x] `validate` command

### ✅ Week 5: MCP Server (Complete)
- [x] MCP server with stdio transport
- [x] `scan_site` tool
- [x] `validate_reproduction` tool  
- [x] `diff_scans` tool
- [x] Claude Desktop integration

### ✅ Week 6: Polish & Testing (Complete - v2.5.0)
- [x] 119 comprehensive tests (5x increase)
- [x] ~85% code coverage across all modules
- [x] Performance benchmarks established
- [x] Security vulnerabilities fixed
- [x] npm published successfully

### 🎯 Future Enhancements (v2.6+)

**Developer Experience:**
- Interactive setup wizard (`repro init`)
- Configuration file support (`.reprorc.json`)
- Multiple output formats (JSON, CSV, GitHub Actions)
- Custom detector plugins API

**New Detectors:**
- SEO detector (meta tags, Open Graph, structured data)
- Performance detector (bundle size, render blocking resources)
- Security detector (CSP violations, mixed content warnings)
- Console warnings (separate from errors)
- Memory leak detection

**Advanced Features:**
- HTML report generator with charts
- GitHub Action for CI/CD integration
- Historical trending and comparison
- Scheduled scanning (cron-like)
- Webhook notifications (Slack, Discord)

**UI/Visualization:**
- Web dashboard for scan results
- Browser extension for one-click scanning
- Interactive issue explorer
- Visual diff comparison

## 🏗️ Architecture

```
src/
├── detectors/           # Issue detection plugins
│   ├── base.ts          # Base detector interface
│   ├── registry.ts      # Detector management
│   ├── js-errors.ts     # JavaScript error detector
│   ├── network-errors.ts # Network failure detector
│   ├── broken-assets.ts  # Asset loading detector
│   ├── accessibility.ts  # WCAG violations (axe-core)
│   ├── web-vitals.ts     # Core Web Vitals
│   ├── mixed-content.ts  # HTTP/HTTPS mixed content
│   └── broken-links.ts   # Broken link checker
├── crawler/             # Multi-page web crawler
│   └── index.ts         # Configurable depth/rate limiting
├── scanner/             # Orchestrates detectors + crawler
│   └── index.ts         # Scan lifecycle management
├── bundler/             # ZIP creation (Week 2)
│   └── index.ts         # HAR + screenshots + script
├── determinism/         # HAR replay & validation (Week 3-4)
│   ├── replayer.ts      # HAR replay via Playwright
│   ├── diff.ts          # Scan comparison utility
│   └── __tests__/       # Unit tests
├── mcp/                 # MCP server (Week 5)
│   ├── server.ts        # MCP tool implementations
│   └── index.ts         # stdio transport
└── cli/                 # Command-line interface
    ├── index.ts         # CLI entry point
    └── commands/        # scan, validate, diff
```

## 🔧 Development

```bash
# Install dependencies
npm install

# Watch mode for development
npm run dev -- scan https://example.com

# Build TypeScript
npm run build

# Run tests (119 tests)
npm test

# Run tests with coverage
npm test -- --coverage --run

# Run tests with UI
npm run test:ui

# Start MCP server
npm run mcp

# Type check
npx tsc --noEmit
```

### Test Coverage

**v2.5.0 Test Suite:**
- 9 test files, 1,397 lines of test code
- 119 tests across all modules
- ~85% code coverage
- Performance benchmarks included

**Test Files:**
- `tests/bundler.test.ts` - Bundle creation & validation
- `tests/crawler.test.ts` - Multi-page crawling logic
- `tests/detectors.test.ts` - All 7 detector implementations
- `tests/cli.test.ts` - CLI command parsing (22 tests)
- `tests/detector-edge-cases.test.ts` - Edge case coverage (22 tests)
- `tests/performance.test.ts` - Performance benchmarks (9 benchmarks)
- `tests/integration/mcp-server.test.ts` - MCP tool validation (35 tests)

## 🤝 Contributing

Contributions are welcome! This project follows a 6-week development plan:
- Weeks 1-6: Core features & testing (✅ Complete)
- v2.5.0: Production-grade quality with comprehensive test coverage

See [ENHANCEMENT_SUMMARY.md](ENHANCEMENT_SUMMARY.md) for v2.5.0 improvements.

## 📝 License

MIT © 2026

---

**Current Version**: 2.5.0 🚀  
**Test Coverage**: 119 tests, ~85% coverage  
**Status**: Production-ready  
**Status**: Week 6 in progress - Final polish before v2.0.0 release  
**Tests**: 15/15 passing ✅
