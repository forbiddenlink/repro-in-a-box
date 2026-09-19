# Repro-in-a-Box 🎁

**Find bugs. Freeze them. Ship them.**

Autonomous QA agent that finds bugs on your site, captures reproducible evidence (HAR files + screenshots), validates reproducibility, and provides Claude Desktop integration via MCP.

[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

See [package.json](./package.json) and [CHANGELOG.md](./CHANGELOG.md) for the current
published version; test/coverage figures below are a point-in-time snapshot, not a live badge.

## ✨ Features

- **12 Built-in Detectors**: JavaScript errors, network failures, broken assets, accessibility (WCAG 2.1), web vitals, mixed content, broken links, console warnings, SEO, performance, security headers, memory leaks
- **Plugin API**: Load `repro-plugin-*` packages or local modules with custom detectors and scan hooks
- **Production-Grade Infrastructure**:
  - Structured logging with multiple output levels
  - Comprehensive error handling with exit codes
  - Configurable timeouts for navigation, actions, and detection
  - Asset blocking for 30-40% faster scans
  - Real-time progress reporting with multiple formats
- **Well Tested**: Vitest suite with ~85% code coverage (see CI for the current test count)
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
pnpm install

# Build
pnpm run build

# Create config file (optional but recommended)
repro init

# Scan a website and create reproducible bundle
repro scan https://your-site.com --bundle

# Validate reproducibility
repro validate repro-your-site-com-*.zip

# Compare two scans
repro diff scan-results-1.json scan-results-2.json

# Start MCP server (for Claude Desktop)
pnpm run mcp
```

## 📚 Documentation

Complete documentation available in the [docs/](./docs/) directory:

- **[Getting Started](./docs/guides/README.md)** - Feature overview, CLI usage, configuration
- **[Logging & Error Handling](./docs/guides/logging.md)** - Structured logging and debugging
- **[Timeout Configuration](./docs/guides/timeout-config.md)** - Network and action timeouts
- **[Asset Blocking](./docs/guides/asset-blocking.md)** - Performance optimization (30-40% faster)
- **[Progress Reporting](./docs/guides/progress.md)** - Real-time scanning feedback
- **[Integration & API](./docs/guides/integration.md)** - Node.js library, CI/CD, MCP server integration
- **[Troubleshooting](./docs/guides/troubleshooting.md)** - Common issues and solutions

**See [docs/README.md](./docs/README.md) for the complete documentation index.**

## 📦 What's in the Box

#### 12 Detectors (`src/detectors/`)

1. **JavaScript Errors** (`js-errors`) - console errors/warnings, uncaught exceptions,
   unhandled promise rejections, full stack traces
2. **Network Errors** (`network-errors`) - failed HTTP requests (4xx/5xx), timeouts, DNS
   failures, connection errors
3. **Broken Assets** (`broken-assets`) - missing images/scripts/stylesheets/fonts/media,
   any resource with HTTP >=400
4. **Accessibility** (`accessibility`) - WCAG 2.1 A/AA via axe-core: alt text, color
   contrast, form labels, landmark structure
5. **Web Vitals** (`web-vitals`) - Core Web Vitals (CLS, INP, LCP) plus FCP/TTFB
6. **Mixed Content** (`mixed-content`) - HTTP resources on HTTPS pages, active/passive
   mixed content
7. **Broken Links** (`broken-links`) - HTTP 4xx/5xx and network failures across all links
   on the page
8. **Console Warnings** (`console-warnings`) - console warnings, deprecations, and
   framework-specific issues
9. **Memory Leak** (`memory-leak`) - growing heap, event listener leaks, detached DOM nodes
10. **Performance** (`performance`) - render-blocking resources, large assets, image
    optimization
11. **Security** (`security`) - HTTPS enforcement, security headers, cookie flags, SRI
    validation
12. **SEO** (`seo`) - meta tags, Open Graph, Twitter Cards, structured data

#### Auto-Bundling

- Creates ZIP bundles with scan results JSON, HAR file (full network recording),
  screenshots of issues, reproduction script, and setup README
- One command to create reproducible packages

#### HAR Replay & Validation

- Replays HAR files using Playwright's `routeFromHAR`
- Runs scans multiple times to validate reproducibility
- Calculates a reproducibility score
- Detailed diff analysis and consistency tracking (always/never/sometimes present)

#### MCP Server

- stdio transport for Claude Desktop
- Tools: `scan_site` (scan and bundle websites), `validate_reproduction` (validate HAR
  replay), `diff_scans` (compare scan results)

## 📋 Commands

### `scan` - Detect issues and create bundles

```bash
repro scan <url> [options]

Options:
  -d, --max-depth <number>    Maximum crawl depth (default: 3)
  -p, --max-pages <number>    Maximum pages to scan (default: 100)
  -r, --rate-limit <ms>       Rate limit between requests (default: 100)
  -o, --output <path>         Output path for results
  -f, --format <type>         Output format: json, html, markdown (default: json)
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

# Markdown report for PRs / CI comments
repro scan https://example.com --format markdown -o report.md

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
repro diff <baseline.json> <comparison.json> [options]

Options:
  -o, --output <path>   Write diff JSON to a file
  --json                Print diff as JSON to stdout
```

Examples:
```bash
repro diff scan-a.json scan-b.json
repro diff scan-a.json scan-b.json --json -o diff.json
```
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
    "format": "json",      // json | text | csv | html | markdown
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
## 🔌 MCP Server Integration

Repro-in-a-Box includes an MCP server for Claude Desktop integration.

### Setup

1. Build the project:
```bash
pnpm run build
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
# Run all tests once (CI-style)
pnpm run test:run

# Run tests in watch mode (default)
pnpm test

# Run tests with UI
pnpm run test:ui

# Generate coverage report
pnpm run test:run -- --coverage
```

See CI for the current test count and coverage; see `tests/` (mirrors `src/` structure).

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
  - Console Warnings (console-warnings)
  - Memory Leak (memory-leak)
  - Performance (performance)
  - Security (security)
  - SEO (seo)

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

See [ROADMAP.md](./ROADMAP.md) for shipped features and what's still planned.

## 🏗️ Architecture

See the Layout section in [CLAUDE.md](./CLAUDE.md) for the full `src/` breakdown (detectors,
crawler, scanner, bundler, determinism, reporters, plugins, config, mcp, cli).

## 🔧 Development

```bash
# Install dependencies
pnpm install

# Watch mode for development
pnpm run dev -- scan https://example.com

# Build TypeScript
pnpm run build

# Run tests
pnpm run test:run

# Run tests with coverage
pnpm run test:run -- --coverage

# Run tests with UI
pnpm run test:ui

# Start MCP server
pnpm run mcp

# Type check
npx tsc --noEmit
```

Tests live in `tests/` (mirrors `src/` structure) and `tests/integration/` (full scan
workflow, MCP tool validation). See CI for the current test count and coverage.

## 🤝 Contributing

Contributions are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) for development
guidelines and [ROADMAP.md](./ROADMAP.md) for what's planned.

## 📝 License

MIT © 2026
