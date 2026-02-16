# Feature Guides & Documentation

Welcome to the Repro-in-a-Box feature documentation. Choose a topic below:

## 📚 Quick Navigation

### Getting Started
- [Installation & Setup](#installation--setup) - Get started quickly
- [CLI Usage](#cli-usage) - Command-line interface guide
- [Configuration](#configuration) - Config file and options reference

### Core Features  
- [Structured Logging](./logging.md) - Debug and monitor your scans
- [Timeout Configuration](./timeout-config.md) - Prevent hangs, optimize speed
- [Asset Blocking](./asset-blocking.md) - 30-40% faster scans
- [Progress Reporting](./progress.md) - Real-time feedback during scanning

### Advanced
- [Integration Guide](./integration.md) - Use as library or MCP server
- [Performance Tuning](./performance.md) - Optimize for your use case
- [Troubleshooting](./troubleshooting.md) - Solve common issues

---

## Installation & Setup

### Quick Start

```bash
# Install globally
npm install -g repro-in-a-box

# Or use directly
npx repro-in-a-box scan https://example.com
```

### Docker

```bash
docker pull forbiddenlink/repro-in-a-box:latest
docker run --rm repro-in-a-box scan https://example.com
```

### As Library

```bash
npm install repro-in-a-box
```

```typescript
import { Scanner } from 'repro-in-a-box/scanner';
import { DetectorRegistry } from 'repro-in-a-box/detectors';

const registry = new DetectorRegistry();
const scanner = new Scanner(registry);
const results = await scanner.scan({ url: 'https://example.com' });
```

---

## CLI Usage

### Basic Scanning

```bash
# Simple scan (defaults applied)
npx repro-in-a-box scan https://example.com

# Verbose output with logging
npx repro-in-a-box scan https://example.com --verbose

# With options
npx repro-in-a-box scan https://example.com \
  --max-pages 50 \
  --max-depth 3 \
  --output results.json
```

### Features

```bash
# Asset blocking (faster scanning)
npx repro-in-a-box scan https://example.com \
  --block-images --block-fonts --block-media

# Timeout configuration
npx repro-in-a-box scan https://example.com \
  --nav-timeout 20000 \
  --action-timeout 15000

# Progress reporting (interactive)
npx repro-in-a-box scan https://example.com --progress detailed

# Create reproducible bundle
npx repro-in-a-box scan https://example.com --bundle

# Validate reproduction
npx repro-in-a-box validate repro.har
```

### Help

```bash
npx repro-in-a-box --help              # General help
npx repro-in-a-box scan --help         # Scan command options
npx repro-in-a-box validate --help     # Validate command options
```

---

## Configuration

### Config File

Create `.reprorc.json` in project root:

```json
{
  "browser": {
    "headless": true,
    "slowMo": 0
  },
  "crawler": {
    "maxDepth": 3,
    "maxPages": 50,
    "rateLimit": 500,
    "sameDomain": true
  },
  "detectors": {
    "enabled": ["javascript-errors", "broken-links", "accessibility"],
    "disabled": []
  },
  "output": {
    "format": "json",
    "path": "./reports",
    "verbose": false
  },
  "bundle": {
    "enabled": true,
    "includeScreenshots": true
  }
}
```

### Environment Variables

```bash
export REPRO_CONFIG=/path/to/.reprorc.json
export REPRO_MAX_PAGES=100
export REPRO_OUTPUT_DIR=./results
export REPRO_VERBOSE=true

npx repro-in-a-box scan https://example.com
```

### CLI Override

CLI options override config file:

```bash
# Config file has maxPages: 50, but this overrides to 20
npx repro-in-a-box scan https://example.com --max-pages 20 --config .reprorc.json
```

---

## Feature Quick Reference

| Feature | CLI Option | Config | Docs |
|---------|:----------:|:------:|:----:|
| **Logging** | --verbose | output.verbose | [logging.md](./logging.md) |
| **Timeouts** | --nav-timeout | (CLI only) | [timeout-config.md](./timeout-config.md) |
| **Asset Blocking** | --block-images | (CLI only) | [asset-blocking.md](./asset-blocking.md) |
| **Progress** | --progress | (CLI only) | [progress.md](./progress.md) |
| **Max Pages** | --max-pages | crawler.maxPages | README |
| **Output Format** | --output, -o | output.path | README |
| **Config File** | --config, -c | (root .reprorc.json) | This file |

---

## Next Steps

Choose your use case:

### 👨‍💼 I want better diagnostics
→ Read [Structured Logging](./logging.md)

### ⚡ I want faster scans
→ Read [Asset Blocking](./asset-blocking.md)

### 🔧 I want better control  
→ Read [Timeout Configuration](./timeout-config.md)

### 📊 I want progress feedback
→ Read [Progress Reporting](./progress.md)

### 🚀 I want to integrate into my app
→ Read [Integration Guide](./integration.md)

---

## Support

- **Issues**: [GitHub Issues](https://github.com/forbiddenlink/repro-in-a-box/issues)
- **Discussions**: [GitHub Discussions](https://github.com/forbiddenlink/repro-in-a-box/discussions)
- **Documentation**: [Full Docs](../README.md)
- **Troubleshooting**: [Troubleshooting Guide](./troubleshooting.md)

---

**Last Updated**: February 16, 2025  
**Version**: v2.7.0
