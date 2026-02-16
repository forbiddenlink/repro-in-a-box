# Documentation Index

Welcome to Repro-in-a-Box documentation. Find guides, API references, troubleshooting help, and session summaries below.

## 📚 Quick Navigation

### Feature Guides
Essential guides for using and integrating Repro-in-a-Box:

- **[Getting Started](./guides/README.md)** - Feature overview, quick start, CLI usage
- **[Logging & Error Handling](./guides/logging.md)** - Structured logging, error types, debugging
- **[Timeout Configuration](./guides/timeout-config.md)** - Timeout types, presets, tuning
- **[Asset Blocking](./guides/asset-blocking.md)** - Performance optimization, usage examples
- **[Progress Reporting](./guides/progress.md)** - Real-time feedback, formats, integration
- **[Integration & API](./guides/integration.md)** - Node.js library, CLI, MCP server, CI/CD
- **[Troubleshooting](./guides/troubleshooting.md)** - Common issues, solutions, diagnostics

### Session History
Implementation summaries and session reports:

- **[Latest Session (Feb 16, 2025)](./session/2025-02-16-complete.md)** - Complete summary of all 5 tasks

---

## 🎯 By Use Case

### I want to...

**Use the CLI**
→ Start with [Getting Started](./guides/README.md#cli-usage)
→ See [Timeout Configuration](./guides/timeout-config.md) for performance tuning
→ Use [Asset Blocking](./guides/asset-blocking.md) for faster scans

**Integrate into my code**
→ Read [Integration & API](./guides/integration.md) for Node.js library
→ Check [Logging & Error Handling](./guides/logging.md) for structured logging
→ See [Getting Started](./guides/README.md) for configuration options

**Debug an issue**
→ Check [Troubleshooting](./guides/troubleshooting.md) first
→ Enable with [Logging & Error Handling](./guides/logging.md#enable-detailed-logging)
→ See specific guides for feature-specific issues

**Deploy to CI/CD**
→ See [Integration & API](./guides/integration.md#cicd-integration) for examples
→ Use [Progress Reporting](./guides/progress.md#cicd-pipeline) for minimal output
→ Use [Asset Blocking](./guides/asset-blocking.md) to save bandwidth

**Optimize performance**
→ Read [Asset Blocking](./guides/asset-blocking.md) guide (30-40% faster)
→ Configure [Timeout Configuration](./guides/timeout-config.md) appropriately
→ Use [Progress Reporting](./guides/progress.md#performance-monitoring) to track improvements

**Monitor progress**
→ See [Progress Reporting](./guides/progress.md) for all formats
→ Use [Logging & Error Handling](./guides/logging.md) for detailed diagnostics

---

## 📖 Guide Overview

| Guide | Purpose | Topics |
|-------|---------|--------|
| [Getting Started](./guides/README.md) | Feature overview | Quick start, CLI usage, config reference |
| [Logging](./guides/logging.md) | Structured logging | Log levels, error types, debugging |
| [Timeouts](./guides/timeout-config.md) | Configuration | Timeout types, presets, tuning |
| [Asset Blocking](./guides/asset-blocking.md) | Performance | Resource types, benchmarks, use cases |
| [Progress](./guides/progress.md) | Monitoring | Formats, events, integration |
| [Integration](./guides/integration.md) | Beyond CLI | Library, MCP server, CI/CD, webhooks |
| [Troubleshooting](./guides/troubleshooting.md) | Problem solving | Common issues, solutions, diagnostics |

---

## 🔧 Configuration Reference

Quick reference for all configuration options:

### CLI Options
```bash
# Timeouts
--nav-timeout <ms>           # Page load timeout (default: 30000)
--action-timeout <ms>        # Action timeout (default: 30000)
--detection-timeout <ms>     # Detection timeout (default: 30000)

# Asset Blocking
--block-images               # Skip image downloads
--block-fonts                # Skip font downloads
--block-media                # Skip media downloads
--block-styles               # Skip stylesheet downloads

# Progress & Output
--progress <format>          # simple, detailed, minimal, or none
--output <file>              # Output file path
--format <type>              # json, html, or csv

# Logging & Debugging
--log <level>                # error, warn, info, or debug
--bundle                     # Include full page bundle
--screenshots                # Capture screenshots
```

### Node.js Configuration
```typescript
const scanner = new Scanner({
  navTimeout: 30000,
  actionTimeout: 30000,
  detectionTimeout: 30000,
  blockImages: true,
  blockFonts: false,
  blockMedia: true,
  blockStyles: false,
  logLevel: 'info',
  progress: true
});
```

---

## 🚀 Popular Commands

```bash
# Fast scan with asset blocking (37% faster)
npx repro-in-a-box scan https://example.com \
  --block-images --block-media --progress simple

# Detailed scan with full diagnostics
npx repro-in-a-box scan https://example.com \
  --no-asset-blocking \
  --log debug \
  --progress detailed \
  --bundle

# CI/CD scan with minimal output
npx repro-in-a-box scan https://example.com \
  --progress minimal \
  --output results.json \
  --format json

# Compare against baseline
npx repro-in-a-box scan https://example.com \
  --diff baseline.json \
  --output comparison.json
```

---

## 📞 Getting Help

1. **Check [Troubleshooting](./guides/troubleshooting.md)** for common issues
2. **Enable debug logging** with `--log debug` flag
3. **Review relevant guide** for your use case
4. **Check [Getting Started](./guides/README.md#cli-usage)** for basic setup

---

## 📋 Document Structure

```
docs/
├── README.md (this file - documentation index)
├── guides/ (feature guides)
│   ├── README.md           (getting started & nav)
│   ├── logging.md          (logging & error handling)
│   ├── timeout-config.md   (timeout configuration)
│   ├── asset-blocking.md   (performance optimization)
│   ├── progress.md         (progress reporting)
│   ├── integration.md      (API & integration)
│   └── troubleshooting.md  (problem solving)
└── session/ (session summaries & reports)
    └── 2025-02-16-complete.md  (latest session)
```

---

## Version Info

**Current Version**: v2.7.0  
**Latest Update**: February 16, 2025  
**Documentation Status**: ✅ Complete  
**Tests**: ✅ 170/170 passing  

For detailed version history, see [CHANGELOG.md](../../CHANGELOG.md) and [ROADMAP.md](../../ROADMAP.md).

---

**Last Updated**: February 16, 2025
