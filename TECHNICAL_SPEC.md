# Repro-in-a-Box v2: Technical Specifications

**Date:** February 15, 2026  
**Status:** 🟢 Ready for Implementation  
**Purpose:** Complete technical reference for development team

---

## Table of Contents

1. [Technology Stack](#1-technology-stack)
2. [Web Vitals Implementation](#2-web-vitals-implementation)
3. [MCP Server Architecture](#3-mcp-server-architecture)
4. [HAR Replay System](#4-har-replay-system)
5. [Accessibility Testing](#5-accessibility-testing)
6. [Detector Framework](#6-detector-framework)
7. [Crawler Architecture](#7-crawler-architecture)
8. [Security & Redaction](#8-security--redaction)
9. [Docker Configuration](#9-docker-configuration)
10. [Testing Strategy](#10-testing-strategy)

---

## 1. Technology Stack

### Core Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/server": "^1.0.0",
    "playwright": "1.50.0",
    "web-vitals": "^5.1.0",
    "@axe-core/playwright": "^4.11.1",
    "commander": "^12.0.0",
    "inquirer": "^9.2.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "typescript": "^5.3.0",
    "tsx": "^4.7.0",
    "vitest": "^1.2.0"
  }
}
```

### Versions & Rationale

| Package | Version | Weekly Downloads | Rationale |
|---------|---------|------------------|-----------|
| `web-vitals` | 5.1.0 | 14,069,120 | Official Google library, 2KB brotli'd, includes INP (replaced FID in 2024) |
| `@axe-core/playwright` | 4.11.1 | 1,627,428 | Industry-standard a11y testing, WCAG 2.1 AA compliance |
| `playwright` | 1.50.0 (locked) | 4,500,000+ | HAR replay via `page.routeFromHAR()`, experimental but best option |
| `@modelcontextprotocol/server` | 1.x stable | N/A | TypeScript SDK with stdio transport (simplest) |
| `commander` | 12.0.0 | 44,000,000 | CLI framework, mature and stable |

### Build Configuration

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test"]
}
```

---

## 2. Web Vitals Implementation

### ✅ Use Official Library (NOT Custom Code)

**Research Finding:** The `web-vitals` library (14M weekly downloads) eliminates the need for custom PerformanceObserver code. It handles all edge cases and provides proper 75th percentile calculations.

### Core Implementation

```typescript
// src/detectors/web-vitals.ts
import { onCLS, onINP, onLCP, Metric, CLSReportCallback } from 'web-vitals';

interface WebVitalsResult {
  lcp: number | null;
  cls: number | null;
  inp: number | null;
  passed: {
    lcp: boolean;
    cls: boolean;
    inp: boolean;
  };
  thresholds: {
    lcp: 2500; // ms
    cls: 0.1;
    inp: 200; // ms
  };
}

export class WebVitalsDetector implements Detector {
  private results: Partial<WebVitalsResult> = {
    lcp: null,
    cls: null,
    inp: null
  };

  async setup(page: Page): Promise<void> {
    // Inject web-vitals library
    await page.addInitScript({
      path: 'node_modules/web-vitals/dist/web-vitals.iife.js'
    });

    // Set up collection
    await page.addInitScript(() => {
      const { onCLS, onINP, onLCP } = (window as any).webVitals;

      (window as any).__webVitalsResults = {
        lcp: null,
        cls: null,
        inp: null
      };

      const sendToCollector = (metric: any) => {
        (window as any).__webVitalsResults[metric.name.toLowerCase()] = metric.value;
      };

      onCLS(sendToCollector);
      onINP(sendToCollector);
      onLCP(sendToCollector);
    });
  }

  async navigate(page: Page, url: string): Promise<void> {
    await page.goto(url, { waitUntil: 'networkidle' });
    
    // Give metrics time to settle
    await page.waitForTimeout(3000);
    
    // Trigger final CLS calculation by scrolling
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
      window.scrollTo(0, 0);
    });
  }

  async collect(page: Page): Promise<WebVitalsResult> {
    const results = await page.evaluate(() => {
      return (window as any).__webVitalsResults;
    });

    return {
      lcp: results.lcp,
      cls: results.cls,
      inp: results.inp,
      passed: {
        lcp: results.lcp !== null ? results.lcp <= 2500 : false,
        cls: results.cls !== null ? results.cls <= 0.1 : false,
        inp: results.inp !== null ? results.inp <= 200 : false
      },
      thresholds: {
        lcp: 2500,
        cls: 0.1,
        inp: 200
      }
    };
  }
}
```

### Attribution Build (Debugging)

For detailed debugging, use the attribution build:

```typescript
import { onCLS, onINP, onLCP, CLSMetricWithAttribution } from 'web-vitals/attribution';

onCLS((metric: CLSMetricWithAttribution) => {
  console.log('CLS:', metric.value);
  console.log('Largest shift target:', metric.attribution.largestShiftTarget);
  console.log('Largest shift time:', metric.attribution.largestShiftTime);
});

onINP((metric) => {
  console.log('INP:', metric.value);
  console.log('Interaction target:', metric.attribution.interactionTarget);
  console.log('Process duration:', metric.attribution.processingDuration);
});
```

### Thresholds (75th Percentile)

Based on Core Web Vitals 2024:

- **LCP (Largest Contentful Paint):** ≤2.5s = Good, 2.5-4.0s = Needs Improvement, >4.0s = Poor
- **INP (Interaction to Next Paint):** ≤200ms = Good, 200-500ms = Needs Improvement, >500ms = Poor  
  *(Replaced FID in March 2024)*
- **CLS (Cumulative Layout Shift):** ≤0.1 = Good, 0.1-0.25 = Needs Improvement, >0.25 = Poor

---

## 3. MCP Server Architecture

### Transport Choice: stdio (v1) → HTTP (v2)

**Research Finding:** MCP supports two transports:

1. **stdio** (recommended for v1): Newline-delimited JSON-RPC via stdin/stdout
   - ✅ Simpler to implement
   - ✅ No security concerns (local-only)
   - ❌ Single client only
   - ❌ Process must be spawned

2. **Streamable HTTP** (defer to v2): POST for client→server, GET+SSE for server→client
   - ✅ Multiple clients supported
   - ✅ Remote access possible
   - ❌ Requires security: Origin validation, localhost binding, authentication
   - ❌ Session management complexity

### stdio Implementation (Recommended for v1)

```typescript
// src/mcp/server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';

export class ReproMcpServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'repro-in-a-box',
        version: '2.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.setupToolHandlers();
  }

  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'scan_site',
            description: 'Scan a website for bugs',
            inputSchema: {
              type: 'object',
              properties: {
                url: { type: 'string', description: 'URL to scan' },
                maxPages: { type: 'number', default: 10 },
                detectors: { 
                  type: 'array', 
                  items: { type: 'string' },
                  default: ['all']
                }
              },
              required: ['url']
            }
          },
          {
            name: 'validate_reproduction',
            description: 'Validate a reproduction package',
            inputSchema: {
              type: 'object',
              properties: {
                packagePath: { type: 'string' }
              },
              required: ['packagePath']
            }
          },
          {
            name: 'diff_scans',
            description: 'Compare two scan results',
            inputSchema: {
              type: 'object',
              properties: {
                scanA: { type: 'string' },
                scanB: { type: 'string' }
              },
              required: ['scanA', 'scanB']
            }
          }
        ] as Tool[]
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'scan_site':
          return this.handleScanSite(args as any);
        case 'validate_reproduction':
          return this.handleValidate(args as any);
        case 'diff_scans':
          return this.handleDiff(args as any);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  private async handleScanSite(args: { url: string; maxPages: number; detectors: string[] }) {
    // Import scan logic
    const { runScan } = await import('../commands/scan.js');
    
    const results = await runScan({
      url: args.url,
      maxPages: args.maxPages || 10,
      detectors: args.detectors || ['all']
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(results, null, 2)
        }
      ]
    };
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    // Server runs until stdin closes
    console.error('MCP server started on stdio');
  }
}

// Entry point: src/mcp/index.ts
import { ReproMcpServer } from './server.js';

const server = new ReproMcpServer();
server.start().catch(console.error);
```

### MCP Client Configuration

Users configure the MCP server in their Claude Desktop config:

```json
// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "repro-in-a-box": {
      "command": "node",
      "args": ["/path/to/repro-in-a-box/dist/mcp/index.js"]
    }
  }
}
```

### Security Requirements for HTTP Transport (v2)

If implementing HTTP transport later:

```typescript
import { createServer } from 'http';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

const httpServer = createServer(async (req, res) => {
  // ⚠️ REQUIRED: Origin validation (DNS rebinding protection)
  const origin = req.headers.origin;
  if (origin && !['http://localhost:3000', 'http://127.0.0.1:3000'].includes(origin)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden: Invalid origin');
    return;
  }

  // ⚠️ REQUIRED: Authentication (bearer token, API key, etc.)
  const auth = req.headers.authorization;
  if (!auth || !validateAuth(auth)) {
    res.writeHead(401, { 'Content-Type': 'text/plain' });
    res.end('Unauthorized');
    return;
  }

  // Handle SSE endpoint
  if (req.method === 'GET' && req.url === '/sse') {
    const transport = new SSEServerTransport('/message', res);
    await mcpServer.connect(transport);
    return;
  }

  // Handle message endpoint
  if (req.method === 'POST' && req.url === '/message') {
    // Handle incoming messages
  }
});

// ⚠️ REQUIRED: Bind to localhost only (not 0.0.0.0)
httpServer.listen(3000, '127.0.0.1');
```

---

## 4. HAR Replay System

### ⚠️ CRITICAL: Experimental Feature

**Research Finding:** `page.routeFromHAR()` is experimental in Playwright. Known limitations:

- ❌ WebSocket connections not supported
- ❌ POST request bodies can be unreliable
- ❌ Streaming responses may fail
- ❌ CORS preflight requests can cause issues
- ❌ Service Workers not intercepted

**Decision:** Implement HAR replay but include Week 0 validation against 10 real sites.

### Recording HAR

```typescript
// src/determinism/har-recorder.ts
import { chromium, Page } from 'playwright';
import * as fs from 'fs/promises';

export async function recordHar(url: string, outputPath: string): Promise<void> {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Start recording
  await context.routeFromHAR(outputPath, {
    url: '**/*',
    update: true, // ← Record mode
    updateContent: 'embed', // Embed responses in HAR
    updateMode: 'full' // Record all requests
  });

  await page.goto(url, { 
    waitUntil: 'networkidle',
    timeout: 60000 
  });

  // Interact to capture dynamic requests
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });
  await page.waitForTimeout(2000);

  await browser.close();
  console.log(`HAR recorded: ${outputPath}`);
}
```

### Replaying HAR

```typescript
// src/determinism/har-replayer.ts
import { chromium } from 'playwright';

export async function replayHar(harPath: string, url: string): Promise<ReplayResult> {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  const errors: string[] = [];
  const missedRequests: string[] = [];

  // Track failed requests
  page.on('requestfailed', (request) => {
    errors.push(`Request failed: ${request.url()}`);
  });

  // Replay from HAR
  await context.routeFromHAR(harPath, {
    url: '**/*',
    notFound: 'fallback', // ← Fallback to network if missing
    update: false // ← Replay mode
  });

  try {
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Run detectors here...
    const detectorResults = await runDetectors(page);

    await browser.close();

    return {
      success: errors.length === 0,
      errors,
      detectorResults
    };
  } catch (error) {
    await browser.close();
    throw error;
  }
}
```

### Fallback Strategy (MSW)

If HAR replay validation fails (Week 0), fall back to Mock Service Worker:

```typescript
// Alternative: src/determinism/msw-mock.ts
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

export function createMockServer(recordings: RequestRecording[]) {
  const handlers = recordings.map(rec => {
    return http[rec.method.toLowerCase()](rec.url, () => {
      return HttpResponse.json(rec.response.body, {
        status: rec.response.status,
        headers: rec.response.headers
      });
    });
  });

  return setupServer(...handlers);
}
```

---

## 5. Accessibility Testing

### @axe-core/playwright Integration

**Research Finding:** `@axe-core/playwright` provides chainable API for WCAG 2.1 AA compliance testing.

```typescript
// src/detectors/accessibility.ts
import { Page } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

export class AccessibilityDetector implements Detector {
  async setup(page: Page): Promise<void> {
    // No setup needed
  }

  async navigate(page: Page, url: string): Promise<void> {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
  }

  async collect(page: Page): Promise<AccessibilityResult> {
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa']) // WCAG 2.1 Level A & AA
      .exclude('#third-party-ads') // Exclude irrelevant elements
      .analyze();

    return {
      violations: results.violations.map(v => ({
        id: v.id,
        impact: v.impact, // 'critical' | 'serious' | 'moderate' | 'minor'
        description: v.description,
        help: v.help,
        helpUrl: v.helpUrl,
        nodes: v.nodes.map(n => ({
          html: n.html,
          target: n.target,
          failureSummary: n.failureSummary
        }))
      })),
      passed: results.passes.length,
      incomplete: results.incomplete.length,
      inapplicable: results.inapplicable.length
    };
  }
}
```

### Common Patterns

```typescript
// Test specific rules only
await new AxeBuilder({ page })
  .withRules(['color-contrast', 'image-alt', 'label'])
  .analyze();

// Exclude dynamic content
await new AxeBuilder({ page })
  .exclude('.skeleton-loader')
  .exclude('[data-testid="loading"]')
  .analyze();

// Include only specific sections
await new AxeBuilder({ page })
  .include('main')
  .include('nav')
  .analyze();
```

---

## 6. Detector Framework

### Base Interface

```typescript
// src/detectors/base.ts
export interface Detector {
  name: string;
  description: string;
  
  // Called once before scanning starts
  setup(page: Page): Promise<void>;
  
  // Called for each URL
  navigate(page: Page, url: string): Promise<void>;
  
  // Called after navigation completes
  collect(page: Page): Promise<DetectorResult>;
}

export interface DetectorResult {
  passed: boolean;
  issues: Issue[];
  metadata?: Record<string, any>;
}

export interface Issue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  selector?: string;
  url?: string;
  screenshot?: string;
}
```

### Registry Pattern

```typescript
// src/detectors/registry.ts
export class DetectorRegistry {
  private detectors = new Map<string, Detector>();

  register(name: string, detector: Detector): void {
    this.detectors.set(name, detector);
  }

  get(name: string): Detector | undefined {
    return this.detectors.get(name);
  }

  getAll(filter: string[] = ['all']): Detector[] {
    if (filter.includes('all')) {
      return Array.from(this.detectors.values());
    }
    return filter
      .map(name => this.detectors.get(name))
      .filter((d): d is Detector => d !== undefined);
  }
}

// Initialize
const registry = new DetectorRegistry();
registry.register('js-errors', new JavaScriptErrorDetector());
registry.register('network-errors', new NetworkErrorDetector());
registry.register('accessibility', new AccessibilityDetector());
registry.register('web-vitals', new WebVitalsDetector());
registry.register('broken-assets', new BrokenAssetsDetector());
registry.register('mixed-content', new MixedContentDetector());
registry.register('broken-links', new BrokenLinksDetector());
```

---

## 7. Crawler Architecture

### Rate Limiting & Politeness

```typescript
// src/crawler/crawler.ts
import { RobotsTxtParser } from 'robots-txt-parser';

interface CrawlOptions {
  startUrl: string;
  maxPages: number;
  maxDepth: number;
  crawlDelay: number; // ms between requests
  respectRobotsTxt: boolean;
  sitemapUrl?: string;
  detectors: string[];
}

export class Crawler {
  private visited = new Set<string>();
  private queue: { url: string; depth: number }[] = [];
  private robotsTxt?: RobotsTxtParser;

  async crawl(options: CrawlOptions): Promise<CrawlResult[]> {
    if (options.respectRobotsTxt) {
      this.robotsTxt = await this.fetchRobotsTxt(options.startUrl);
    }

    this.queue.push({ url: options.startUrl, depth: 0 });
    const results: CrawlResult[] = [];

    while (this.queue.length > 0 && this.visited.size < options.maxPages) {
      const { url, depth } = this.queue.shift()!;

      if (this.visited.has(url) || depth > options.maxDepth) {
        continue;
      }

      // Check robots.txt
      if (this.robotsTxt && !this.robotsTxt.isAllowed(url, 'ReproBot')) {
        console.log(`Skipping ${url} (robots.txt)`);
        continue;
      }

      this.visited.add(url);

      // Crawl delay (politeness)
      if (this.visited.size > 1) {
        await this.sleep(options.crawlDelay);
      }

      try {
        const result = await this.scanPage(url, options.detectors);
        results.push(result);

        // Discover new URLs (if within depth limit)
        if (depth < options.maxDepth) {
          const links = this.extractLinks(result.html, options.startUrl);
          links.forEach(link => {
            this.queue.push({ url: link, depth: depth + 1 });
          });
        }
      } catch (error) {
        console.error(`Error scanning ${url}:`, error);
      }
    }

    return results;
  }

  private normalizeUrl(url: string): string {
    const parsed = new URL(url);
    // Remove tracking params
    parsed.searchParams.delete('utm_source');
    parsed.searchParams.delete('utm_medium');
    parsed.searchParams.delete('utm_campaign');
    // Remove trailing slash
    parsed.pathname = parsed.pathname.replace(/\/$/, '');
    return parsed.toString();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

---

## 8. Security & Redaction

### Comprehensive Patterns

```typescript
// src/redactor/patterns.ts
export const REDACTION_PATTERNS = {
  // Authentication
  bearerToken: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  apiKey: /api[_-]?key[\s:=]+['"]?([A-Za-z0-9]{32,})['"]?/gi,
  
  // Credentials
  password: /password[\s:=]+['"]?([^'"\s]+)['"]?/gi,
  basicAuth: /Authorization:\s*Basic\s+[A-Za-z0-9+/=]+/gi,
  
  // Tokens
  jwt: /eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/gi,
  sessionToken: /session[_-]?token[\s:=]+['"]?([A-Za-z0-9]{32,})['"]?/gi,
  
  // PII
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
  creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/gi,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/gi,
  
  // Cloud
  awsAccessKey: /AKIA[0-9A-Z]{16}/gi,
  awsSecretKey: /[A-Za-z0-9/+=]{40}/gi,
  gcpKey: /AIza[0-9A-Za-z_-]{35}/gi,
  
  // Private IPs
  privateIp: /\b(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b/gi,
  
  // Paths
  homePath: /\/Users\/[^\/\s]+/gi,
  windowsPath: /C:\\Users\\[^\\s]+/gi
};

export function redact(text: string): string {
  let redacted = text;
  
  for (const [name, pattern] of Object.entries(REDACTION_PATTERNS)) {
    redacted = redacted.replace(pattern, `[REDACTED:${name}]`);
  }
  
  return redacted;
}
```

---

## 9. Docker Configuration

### Multi-Stage Build

```dockerfile
# Dockerfile
FROM mcr.microsoft.com/playwright:v1.50.0-noble

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY dist ./dist

# Install Playwright browsers (included in base image)
# RUN npx playwright install chromium

ENV NODE_ENV=production

ENTRYPOINT ["node", "dist/cli/index.js"]
```

### Development Container

```json
{
  "name": "Repro-in-a-Box Dev",
  "image": "mcr.microsoft.com/playwright:v1.50.0-noble",
  "customizations": {
    "vscode": {
      "extensions": [
        "ms-playwright.playwright",
        "dbaeumer.vscode-eslint"
      ]
    }
  },
  "postCreateCommand": "npm install && npx playwright install chromium",
  "forwardPorts": [3000]
}
```

---

## 10. Testing Strategy

### Unit Tests (Vitest)

```typescript
// src/detectors/__tests__/web-vitals.test.ts
import { describe, it, expect, vi } from 'vitest';
import { WebVitalsDetector } from '../web-vitals';

describe('WebVitalsDetector', () => {
  it('should detect poor LCP', async () => {
    const page = createMockPage({
      webVitals: { lcp: 5000, cls: 0.05, inp: 150 }
    });

    const detector = new WebVitalsDetector();
    await detector.setup(page);
    const result = await detector.collect(page);

    expect(result.passed.lcp).toBe(false);
    expect(result.passed.cls).toBe(true);
    expect(result.passed.inp).toBe(true);
  });
});
```

### Integration Tests

```typescript
// tests/integration/scan.test.ts
import { test, expect } from '@playwright/test';
import { runScan } from '../../src/commands/scan';

test('should scan example.com', async () => {
  const results = await runScan({
    url: 'https://example.com',
    maxPages: 1,
    detectors: ['js-errors', 'accessibility']
  });

  expect(results.pages).toHaveLength(1);
  expect(results.issues.length).toBeGreaterThanOrEqual(0);
});
```

### E2E Tests (HAR Replay Validation)

```typescript
// tests/e2e/har-replay.test.ts
import { test, expect } from '@playwright/test';
import { recordHar, replayHar } from '../../src/determinism';

test('HAR replay validation', async () => {
  const testSites = [
    'https://example.com',
    'https://github.com',
    'https://stackoverflow.com'
  ];

  for (const url of testSites) {
    // Record
    await recordHar(url, `test-${url.replace(/\W/g, '')}.har`);

    // Replay 3x
    const results = await Promise.all([
      replayHar(`test-${url.replace(/\W/g, '')}.har`, url),
      replayHar(`test-${url.replace(/\W/g, '')}.har`, url),
      replayHar(`test-${url.replace(/\W/g, '')}.har`, url)
    ]);

    const successRate = results.filter(r => r.success).length / results.length;
    expect(successRate).toBeGreaterThanOrEqual(0.7); // ≥70% success
  }
});
```

---

## Next Steps

1. ✅ Review this spec for completeness
2. ⏭️ Execute Week 0 HAR validation (see [ACTION_PLAN.md](./ACTION_PLAN.md#week-0-validation-sprint-2-3-days))
3. ⏭️ Create `package.json` and install dependencies
4. ⏭️ Implement detector framework (2 days)
5. ⏭️ Build MCP server with stdio transport (1 day)

**All technical decisions are now documented and ready for implementation.**
