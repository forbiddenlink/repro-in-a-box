# Integration & API Usage

## Overview

Integrate **repro-in-a-box** into your applications, CI/CD pipelines, and MCP-compatible IDEs. Use as a **Node.js library**, **CLI tool**, or **MCP server**.

## Node.js Library

### Installation

```bash
npm install repro-in-a-box
# or
yarn add repro-in-a-box
# or
pnpm add repro-in-a-box
```

### Basic Usage

```typescript
import { Scanner } from 'repro-in-a-box';

const scanner = new Scanner({
  headless: true,
  timeout: 30000,
});

const results = await scanner.scan('https://example.com');

console.log('Issues found:', results.issues.length);
results.issues.forEach((issue) => {
  console.log(`[${issue.severity}] ${issue.title}`);
});
```

### Configuration

```typescript
import { Scanner, LogLevel } from 'repro-in-a-box';

const scanner = new Scanner({
  // Navigation & timeouts
  navTimeout: 30000,           // Page load timeout
  actionTimeout: 15000,        // Action execution timeout
  detectionTimeout: 20000,     // Detection timeout
  
  // Asset optimization
  blockImages: true,           // Skip image downloads
  blockFonts: false,           // Load fonts
  blockMedia: true,            // Skip video/audio
  blockStyles: false,          // Load stylesheets
  
  // Logging & output
  logLevel: LogLevel.INFO,     // info, debug, warn, error
  progress: true,              // Show progress
  bundle: false,               // Include full page bundle
  
  // Browser configuration
  headless: true,              // Headless mode
  slowMo: 0,                   // Slow down actions (ms)
  maxPages: 50,                // Max pages to scan
  rateLimitMs: 100,            // Delay between pages
});

const results = await scanner.scan('https://example.com');
```

### Accessing Results

```typescript
// Results structure
const results = await scanner.scan('https://example.com');

interface ScanResults {
  url: string;
  timestamp: number;
  duration: number;
  pagesAnalyzed: number;
  
  issues: Issue[];          // All detected issues
  detections: Detection[];  // Raw detection data
  pages: Page[];            // Analyzed pages
  
  summary: {
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
  };
}

// Filter by severity
const critical = results.issues.filter(i => i.severity === 'critical');

// Filter by type
const a11yIssues = results.issues.filter(i => i.type === 'accessibility');

// Export to JSON
console.log(JSON.stringify(results, null, 2));
```

### Error Handling

```typescript
import { Scanner, ScanError } from 'repro-in-a-box';

const scanner = new Scanner();

try {
  const results = await scanner.scan('https://example.com');
} catch (error) {
  if (error instanceof ScanError) {
    console.error(`Scan failed: ${error.message}`);
    console.error(`Exit code: ${error.exitCode}`);
  } else {
    throw error;
  }
}
```

## CLI Integration

### Basic Command

```bash
npx repro-in-a-box scan <url> [options]
```

### Common Options

```bash
# Asset blocking
--block-images
--block-fonts
--block-media
--block-styles

# Timeouts (milliseconds)
--nav-timeout 30000
--action-timeout 15000
--detection-timeout 20000

# Output & formatting
--output results.json
--format json|html|csv
--progress simple|detailed|minimal

# Pagination & rate limiting
--max-pages 50
--rate-limit 100

# Logging
--log debug|info|warn|error
--quiet

# Browser behavior
--headless
--headless=false
--slow-mo 100

# Miscellaneous
--bundle
--screenshots
--diff baseline.json
```

### Example Workflows

#### Scan and Export JSON
```bash
npx repro-in-a-box scan https://example.com \
  --output results.json \
  --format json
```

#### Generate HTML Report
```bash
npx repro-in-a-box scan https://example.com \
  --output report.html \
  --format html \
  --screenshots
```

#### Compare Against Baseline
```bash
# Create baseline
npx repro-in-a-box scan https://example.com \
  --output baseline.json

# Compare later
npx repro-in-a-box scan https://example.com \
  --diff baseline.json \
  --output comparison.json
```

## MCP Server Integration

### Starting the Server

```bash
# Via npx
npx repro-in-a-box mcp-server --port 3001

# Via Docker
docker run -p 3001:3001 repro-in-a-box mcp-server
```

### Configuration

**.claude/settings.json** (Claude IDE):
```json
{
  "mcpServers": {
    "repro-audit": {
      "command": "npx",
      "args": ["repro-in-a-box", "mcp-server", "--port", "3001"],
      "env": {
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### Available MCP Tools

```typescript
// Tool: audit_website
{
  "url": "https://example.com",
  "detectors": ["accessibility", "performance", "security"],
  "timeout": 30000
}

// Tool: compare_scans
{
  "url": "https://example.com",
  "previous_file": "/path/to/baseline.json"
}

// Tool: generate_report
{
  "results_file": "/path/to/results.json",
  "format": "html|json|markdown"
}
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Website Audit

on: [push, pull_request]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install
        run: npm install -g repro-in-a-box
      
      - name: Scan website
        run: |
          npx repro-in-a-box scan https://example.com \
            --progress minimal \
            --output results.json \
            --log info
      
      - name: Comment results
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const results = JSON.parse(fs.readFileSync('results.json'));
            const summary = `
            ✅ Scan Complete
            - Issues: ${results.summary.total}
            - Pages: ${results.pagesAnalyzed}
            `;
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: summary
            });
```

### GitLab CI

```yaml
website_audit:
  image: node:20
  script:
    - npm install -g repro-in-a-box
    - npx repro-in-a-box scan https://example.com
      --progress minimal
      --output results.json
      --exit-code
  artifacts:
    reports:
      results: results.json
  allow_failure: true
```

### Docker Integration

```dockerfile
FROM node:20-alpine

RUN npm install -g repro-in-a-box

WORKDIR /app
COPY urls.txt ./

RUN npx repro-in-a-box scan https://example.com \
  --output report.json \
  --progress minimal

CMD ["cat", "report.json"]
```

## Webhook Integration

### Trigger Scans from Webhooks

```typescript
import express from 'express';
import { Scanner } from 'repro-in-a-box';

const app = express();
const scanner = new Scanner();

app.post('/webhook/deploy', async (req, res) => {
  const { url, environment } = req.body;
  
  try {
    const results = await scanner.scan(url);
    
    if (results.summary.byType.critical > 0) {
      // Alert on critical issues
      await notifySlack(
        `🚨 Critical issues on ${environment}`,
        results
      );
    }
    
    res.json({ success: true, issues: results.summary.total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000);
```

## Batch Processing

### Scan Multiple URLs

```bash
#!/bin/bash

while read url; do
  echo "Scanning: $url"
  npx repro-in-a-box scan "$url" \
    --output "results/$(echo $url | sed 's/https:\/\///g').json" \
    --progress minimal
done < urls.txt
```

### Programmatic Batch

```typescript
import { Scanner } from 'repro-in-a-box';

const urls = [
  'https://example.com',
  'https://blog.example.com',
  'https://api-docs.example.com'
];

const scanner = new Scanner();
const results = [];

for (const url of urls) {
  const result = await scanner.scan(url);
  results.push(result);
}

// Aggregate results
const summary = {
  totalPages: results.reduce((sum, r) => sum + r.pagesAnalyzed, 0),
  totalIssues: results.reduce((sum, r) => sum + r.issues.length, 0),
  byUrl: results.map(r => ({
    url: r.url,
    issues: r.issues.length
  }))
};

console.log(JSON.stringify(summary, null, 2));
```

---

See [Feature Guides](./README.md) for more information.
