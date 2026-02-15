# Repro-in-a-Box v2: Implementation Guide

**Purpose:** Step-by-step guide to build Repro-in-a-Box v2 from scratch  
**Audience:** Development team  
**Timeline:** 6 weeks (with Week 0 validation)

---

## Table of Contents

1. [Week 0: Critical Validation](#week-0-critical-validation)
2. [Week 1: Project Setup & Simple Detectors](#week-1-project-setup--simple-detectors)
3. [Week 2: Scan Command & Auto-Bundle](#week-2-scan-command--auto-bundle)
4. [Week 3-4: Determinism Validation](#week-3-4-determinism-validation)
5. [Week 5: MCP Server & Diff](#week-5-mcp-server--diff)
6. [Week 6: Testing & Polish](#week-6-testing--polish)

---

## Week 0: Critical Validation

**Goal:** Validate HAR replay works on real sites before committing to implementation

### Day 1: HAR Replay Prototype

Create a minimal test script to validate Playwright's `page.routeFromHAR()`:

```bash
mkdir repro-in-a-box
cd repro-in-a-box
npm init -y
npm install playwright@1.50.0 tsx
```

**File: `test-har-replay.ts`**

```typescript
import { chromium } from 'playwright';
import * as fs from 'fs/promises';

interface TestResult {
  url: string;
  recorded: boolean;
  replays: {
    attempt: number;
    success: boolean;
    error?: string;
    duration: number;
  }[];
  successRate: number;
}

async function testSite(url: string, siteId: string): Promise<TestResult> {
  const harPath = `./test-hars/${siteId}.har`;
  const result: TestResult = {
    url,
    recorded: false,
    replays: [],
    successRate: 0
  };

  try {
    // Step 1: Record HAR
    console.log(`\n📹 Recording ${url}...`);
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    
    await context.routeFromHAR(harPath, {
      url: '**/*',
      update: true,
      updateContent: 'embed',
      updateMode: 'full'
    });

    const page = await context.newPage();
    await page.goto(url, { 
      waitUntil: 'networkidle',
      timeout: 60000 
    });
    
    // Scroll to trigger lazy-loaded content
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);
    
    await browser.close();
    result.recorded = true;
    console.log(`✅ HAR recorded: ${harPath}`);

    // Step 2: Replay 3x
    for (let i = 1; i <= 3; i++) {
      console.log(`\n🔄 Replay attempt ${i}/3...`);
      const startTime = Date.now();
      
      const replayBrowser = await chromium.launch({ headless: true });
      const replayContext = await replayBrowser.newContext();
      
      await replayContext.routeFromHAR(harPath, {
        url: '**/*',
        notFound: 'fallback',
        update: false
      });

      const replayPage = await replayContext.newPage();
      
      try {
        await replayPage.goto(url, {
          waitUntil: 'networkidle',
          timeout: 30000
        });
        
        const duration = Date.now() - startTime;
        result.replays.push({
          attempt: i,
          success: true,
          duration
        });
        console.log(`✅ Success (${duration}ms)`);
      } catch (error: any) {
        const duration = Date.now() - startTime;
        result.replays.push({
          attempt: i,
          success: false,
          error: error.message,
          duration
        });
        console.log(`❌ Failed: ${error.message}`);
      }
      
      await replayBrowser.close();
    }

    // Calculate success rate
    const successes = result.replays.filter(r => r.success).length;
    result.successRate = successes / result.replays.length;

  } catch (error: any) {
    console.error(`❌ Critical error testing ${url}:`, error.message);
  }

  return result;
}

async function main() {
  // Create test-hars directory
  await fs.mkdir('./test-hars', { recursive: true });

  const testSites = [
    { url: 'https://example.com', id: 'example' },
    { url: 'https://github.com', id: 'github' },
    { url: 'https://news.ycombinator.com', id: 'hn' },
    { url: 'https://stackoverflow.com', id: 'stackoverflow' },
    { url: 'https://playwright.dev', id: 'playwright' },
    { url: 'https://vercel.com', id: 'vercel' },
    { url: 'https://stripe.com/docs', id: 'stripe' },
    { url: 'https://developer.mozilla.org', id: 'mdn' },
    { url: 'https://reddit.com', id: 'reddit' },
    { url: 'https://npmjs.com', id: 'npm' }
  ];

  console.log('🚀 HAR Replay Validation Test');
  console.log('=============================\n');

  const results: TestResult[] = [];

  for (const site of testSites) {
    const result = await testSite(site.url, site.id);
    results.push(result);
  }

  // Print summary
  console.log('\n\n📊 SUMMARY');
  console.log('==========\n');

  const summaryTable = results.map(r => {
    const status = r.successRate >= 0.7 ? '✅' : r.successRate >= 0.5 ? '⚠️' : '❌';
    return {
      Status: status,
      Site: r.url,
      'Success Rate': `${(r.successRate * 100).toFixed(0)}%`,
      Recorded: r.recorded ? 'Yes' : 'No'
    };
  });

  console.table(summaryTable);

  // Calculate overall stats
  const totalSuccessRate = results.reduce((sum, r) => sum + r.successRate, 0) / results.length;
  const sitesAbove70 = results.filter(r => r.successRate >= 0.7).length;

  console.log(`\nOverall Success Rate: ${(totalSuccessRate * 100).toFixed(1)}%`);
  console.log(`Sites with ≥70% success: ${sitesAbove70}/${results.length}`);

  // Decision
  console.log('\n🎯 DECISION');
  console.log('===========\n');

  if (totalSuccessRate >= 0.7) {
    console.log('✅ HAR replay is VIABLE');
    console.log('→ Proceed with original plan (page.routeFromHAR)');
  } else if (totalSuccessRate >= 0.5) {
    console.log('⚠️ HAR replay is MARGINAL');
    console.log('→ Consider MSW fallback for problematic sites');
  } else {
    console.log('❌ HAR replay is NOT VIABLE');
    console.log('→ Use Mock Service Worker (MSW) for determinism');
  }

  // Save detailed results
  await fs.writeFile(
    './har-validation-results.json',
    JSON.stringify(results, null, 2)
  );
  console.log('\n💾 Detailed results saved to: har-validation-results.json');
}

main().catch(console.error);
```

**Run the validation:**

```bash
npx tsx test-har-replay.ts
```

**Expected output:**

```
🚀 HAR Replay Validation Test
=============================

📹 Recording https://example.com...
✅ HAR recorded: ./test-hars/example.har

🔄 Replay attempt 1/3...
✅ Success (1234ms)

🔄 Replay attempt 2/3...
✅ Success (987ms)

🔄 Replay attempt 3/3...
✅ Success (1056ms)

...

📊 SUMMARY
==========

┌─────────┬──────────────────────────────┬──────────────┬──────────┐
│ Status  │ Site                         │ Success Rate │ Recorded │
├─────────┼──────────────────────────────┼──────────────┼──────────┤
│ ✅      │ https://example.com          │ 100%         │ Yes      │
│ ✅      │ https://github.com           │ 100%         │ Yes      │
│ ✅      │ https://news.ycombinator.com │ 100%         │ Yes      │
│ ⚠️      │ https://stackoverflow.com    │ 67%          │ Yes      │
│ ✅      │ https://playwright.dev       │ 100%         │ Yes      │
│ ✅      │ https://vercel.com           │ 100%         │ Yes      │
│ ❌      │ https://stripe.com/docs      │ 33%          │ Yes      │
│ ✅      │ https://developer.mozilla... │ 100%         │ Yes      │
│ ❌      │ https://reddit.com           │ 0%           │ Yes      │
│ ✅      │ https://npmjs.com            │ 100%         │ Yes      │
└─────────┴──────────────────────────────┴──────────────┴──────────┘

Overall Success Rate: 80.0%
Sites with ≥70% success: 8/10

🎯 DECISION
===========

✅ HAR replay is VIABLE
→ Proceed with original plan (page.routeFromHAR)

💾 Detailed results saved to: har-validation-results.json
```

### Day 2: Analyze Results & Decide

**If ≥70% success rate:**
- ✅ Proceed with HAR-based determinism
- Document known limitations (WebSockets, POST bodies, streaming)
- Plan fallback for problematic sites

**If 50-70% success rate:**
- ⚠️ Hybrid approach: HAR for simple sites, MSW for complex
- Investigate failures (check `har-validation-results.json`)
- Consider implementing both backends

**If <50% success rate:**
- ❌ Skip HAR replay, use MSW from the start
- Update architecture docs
- Research MSW integration patterns

---

## Week 1: Project Setup & Simple Detectors

### Day 1: Project Initialization

```bash
# Initialize TypeScript project
npm init -y

# Install core dependencies
npm install \
  playwright@1.50.0 \
  @modelcontextprotocol/sdk@^1.0.0 \
  web-vitals@^5.1.0 \
  @axe-core/playwright@^4.11.1 \
  commander@^12.0.0 \
  inquirer@^9.2.0 \
  zod@^3.22.0

# Install dev dependencies
npm install -D \
  @types/node@^20.11.0 \
  @types/inquirer@^9.0.0 \
  typescript@^5.3.0 \
  tsx@^4.7.0 \
  vitest@^1.2.0 \
  @playwright/test@1.50.0

# Initialize TypeScript
npx tsc --init
```

**File: `tsconfig.json`**

```json
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
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test"]
}
```

**File: `package.json` (update scripts)**

```json
{
  "type": "module",
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/cli/index.ts",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "mcp": "node dist/mcp/index.js"
  }
}
```

### Day 2: Detector Framework

**File: `src/detectors/base.ts`**

```typescript
import { Page } from 'playwright';

export interface Detector {
  name: string;
  description: string;
  setup(page: Page): Promise<void>;
  navigate(page: Page, url: string): Promise<void>;
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

**File: `src/detectors/registry.ts`**

```typescript
import { Detector } from './base.js';

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

  list(): { name: string; description: string }[] {
    return Array.from(this.detectors.values()).map(d => ({
      name: d.name,
      description: d.description
    }));
  }
}
```

### Day 3: JavaScript Error Detector

**File: `src/detectors/js-errors.ts`**

```typescript
import { Page } from 'playwright';
import { Detector, DetectorResult, Issue } from './base.js';

export class JavaScriptErrorDetector implements Detector {
  name = 'js-errors';
  description = 'Detects JavaScript errors and unhandled promise rejections';

  private errors: Issue[] = [];

  async setup(page: Page): Promise<void> {
    // Listen for page errors
    page.on('pageerror', (error) => {
      this.errors.push({
        severity: 'critical',
        message: `Uncaught exception: ${error.message}`,
        url: page.url()
      });
    });

    // Listen for console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        this.errors.push({
          severity: 'high',
          message: `Console error: ${msg.text()}`,
          url: page.url()
        });
      }
    });

    // Listen for unhandled promise rejections
    await page.addInitScript(() => {
      window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled promise rejection:', event.reason);
      });
    });
  }

  async navigate(page: Page, url: string): Promise<void> {
    this.errors = []; // Reset for new page
    await page.goto(url, { waitUntil: 'networkidle' });
  }

  async collect(page: Page): Promise<DetectorResult> {
    return {
      passed: this.errors.length === 0,
      issues: this.errors,
      metadata: {
        errorCount: this.errors.length
      }
    };
  }
}
```

### Day 4: Network Error Detector

**File: `src/detectors/network-errors.ts`**

```typescript
import { Page } from 'playwright';
import { Detector, DetectorResult, Issue } from './base.js';

export class NetworkErrorDetector implements Detector {
  name = 'network-errors';
  description = 'Detects failed network requests';

  private failures: Issue[] = [];

  async setup(page: Page): Promise<void> {
    page.on('requestfailed', (request) => {
      const failure = request.failure();
      this.failures.push({
        severity: 'high',
        message: `Request failed: ${request.url()}`,
        url: page.url(),
        metadata: {
          method: request.method(),
          resourceType: request.resourceType(),
          errorText: failure?.errorText
        }
      } as any);
    });
  }

  async navigate(page: Page, url: string): Promise<void> {
    this.failures = [];
    await page.goto(url, { waitUntil: 'networkidle' });
  }

  async collect(page: Page): Promise<DetectorResult> {
    return {
      passed: this.failures.length === 0,
      issues: this.failures,
      metadata: {
        failureCount: this.failures.length
      }
    };
  }
}
```

### Day 5: Broken Assets Detector

**File: `src/detectors/broken-assets.ts`**

```typescript
import { Page } from 'playwright';
import { Detector, DetectorResult, Issue } from './base.js';

export class BrokenAssetsDetector implements Detector {
  name = 'broken-assets';
  description = 'Detects broken images, stylesheets, and scripts';

  private brokenAssets: Issue[] = [];

  async setup(page: Page): Promise<void> {
    page.on('response', (response) => {
      const url = response.url();
      const status = response.status();
      const resourceType = response.request().resourceType();

      if (
        status >= 400 &&
        ['image', 'stylesheet', 'script', 'font'].includes(resourceType)
      ) {
        this.brokenAssets.push({
          severity: status === 404 ? 'high' : 'medium',
          message: `${resourceType} failed to load (${status}): ${url}`,
          url: page.url()
        });
      }
    });
  }

  async navigate(page: Page, url: string): Promise<void> {
    this.brokenAssets = [];
    await page.goto(url, { waitUntil: 'networkidle' });
  }

  async collect(page: Page): Promise<DetectorResult> {
    return {
      passed: this.brokenAssets.length === 0,
      issues: this.brokenAssets,
      metadata: {
        brokenCount: this.brokenAssets.length
      }
    };
  }
}
```

---

## Week 2: Scan Command & Auto-Bundle

### Day 1: CLI Framework

**File: `src/cli/index.ts`**

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { scanCommand } from './commands/scan.js';
import { validateCommand } from './commands/validate.js';
import { diffCommand } from './commands/diff.js';

const program = new Command();

program
  .name('repro')
  .description('Find bugs. Freeze them. Ship them.')
  .version('2.0.0');

program
  .command('scan')
  .description('Scan a website for bugs')
  .argument('<url>', 'URL to scan')
  .option('-p, --max-pages <number>', 'Maximum pages to crawl', '10')
  .option('-d, --detectors <list>', 'Comma-separated detector names', 'all')
  .option('-o, --output <path>', 'Output directory', './repro-output')
  .action(scanCommand);

program
  .command('validate')
  .description('Validate a reproduction package')
  .argument('<package>', 'Path to reproduction package')
  .option('--runs <number>', 'Number of validation runs', '3')
  .action(validateCommand);

program
  .command('diff')
  .description('Compare two scan results')
  .argument('<scanA>', 'First scan directory')
  .argument('<scanB>', 'Second scan directory')
  .action(diffCommand);

program.parse();
```

**File: `src/cli/commands/scan.ts`**

```typescript
import { chromium } from 'playwright';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DetectorRegistry } from '../../detectors/registry.js';
import { JavaScriptErrorDetector } from '../../detectors/js-errors.js';
import { NetworkErrorDetector } from '../../detectors/network-errors.js';
import { BrokenAssetsDetector } from '../../detectors/broken-assets.js';

export async function scanCommand(
  url: string,
  options: { maxPages: string; detectors: string; output: string }
) {
  console.log(`🔍 Scanning ${url}...`);

  // Initialize registry
  const registry = new DetectorRegistry();
  registry.register('js-errors', new JavaScriptErrorDetector());
  registry.register('network-errors', new NetworkErrorDetector());
  registry.register('broken-assets', new BrokenAssetsDetector());

  // Get requested detectors
  const detectorNames = options.detectors.split(',');
  const detectors = registry.getAll(detectorNames);

  console.log(`Using detectors: ${detectors.map(d => d.name).join(', ')}`);

  // Launch browser
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Setup detectors
  for (const detector of detectors) {
    await detector.setup(page);
  }

  // Navigate
  for (const detector of detectors) {
    await detector.navigate(page, url);
  }

  // Collect results
  const results = [];
  for (const detector of detectors) {
    const result = await detector.collect(page);
    results.push({
      detector: detector.name,
      ...result
    });
  }

  await browser.close();

  // Save results
  const outputDir = options.output;
  await fs.mkdir(outputDir, { recursive: true });

  const reportPath = path.join(outputDir, 'scan-results.json');
  await fs.writeFile(reportPath, JSON.stringify(results, null, 2));

  console.log(`\n✅ Scan complete! Results saved to: ${reportPath}`);

  // Print summary
  const issueCount = results.reduce((sum, r) => sum + r.issues.length, 0);
  console.log(`\n📊 Found ${issueCount} issues across ${results.length} detectors`);
}
```

**Test the CLI:**

```bash
npm run build
node dist/cli/index.js scan https://example.com
```

### Day 2-3: Crawler Implementation

**File: `src/crawler/crawler.ts`**

```typescript
import { chromium, Page } from 'playwright';
import { DetectorRegistry } from '../detectors/registry.js';

interface CrawlOptions {
  startUrl: string;
  maxPages: number;
  maxDepth: number;
  crawlDelay: number;
  detectors: string[];
}

interface CrawlResult {
  url: string;
  depth: number;
  detectorResults: any[];
}

export class Crawler {
  private visited = new Set<string>();
  private queue: { url: string; depth: number }[] = [];

  async crawl(options: CrawlOptions, registry: DetectorRegistry): Promise<CrawlResult[]> {
    this.queue.push({ url: options.startUrl, depth: 0 });
    const results: CrawlResult[] = [];

    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    const detectors = registry.getAll(options.detectors);

    // Setup detectors once
    for (const detector of detectors) {
      await detector.setup(page);
    }

    while (this.queue.length > 0 && this.visited.size < options.maxPages) {
      const { url, depth } = this.queue.shift()!;

      if (this.visited.has(url) || depth > options.maxDepth) {
        continue;
      }

      console.log(`\n[${this.visited.size + 1}/${options.maxPages}] Scanning: ${url}`);
      this.visited.add(url);

      // Crawl delay (politeness)
      if (this.visited.size > 1) {
        await new Promise(resolve => setTimeout(resolve, options.crawlDelay));
      }

      try {
        // Navigate with each detector
        for (const detector of detectors) {
          await detector.navigate(page, url);
        }

        // Collect results
        const detectorResults = [];
        for (const detector of detectors) {
          const result = await detector.collect(page);
          detectorResults.push({
            detector: detector.name,
            ...result
          });
        }

        results.push({ url, depth, detectorResults });

        // Discover links (if within depth limit)
        if (depth < options.maxDepth) {
          const links = await this.extractLinks(page, options.startUrl);
          links.forEach(link => {
            if (!this.visited.has(link)) {
              this.queue.push({ url: link, depth: depth + 1 });
            }
          });
        }
      } catch (error: any) {
        console.error(`❌ Error scanning ${url}:`, error.message);
      }
    }

    await browser.close();
    return results;
  }

  private async extractLinks(page: Page, baseUrl: string): Promise<string[]> {
    const links = await page.evaluate((base) => {
      const anchors = Array.from(document.querySelectorAll('a[href]'));
      return anchors
        .map(a => (a as HTMLAnchorElement).href)
        .filter(href => href.startsWith(base));
    }, baseUrl);

    return [...new Set(links)]; // Deduplicate
  }
}
```

### Day 4-5: Auto-Bundle Feature

**File: `src/bundler/bundler.ts`**

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import AdmZip from 'adm-zip';

interface BundleOptions {
  resultsPath: string;
  outputPath: string;
  includeHar?: boolean;
}

export async function createBundle(options: BundleOptions): Promise<string> {
  const zip = new AdmZip();

  // Add scan results
  const results = await fs.readFile(options.resultsPath, 'utf-8');
  zip.addFile('scan-results.json', Buffer.from(results));

  // Add HAR if available
  if (options.includeHar) {
    const harPath = path.join(path.dirname(options.resultsPath), 'recording.har');
    try {
      const har = await fs.readFile(harPath);
      zip.addFile('recording.har', har);
    } catch {
      console.warn('⚠️ HAR file not found, skipping');
    }
  }

  // Add reproduction script
  const reproScript = generateReproductionScript(results);
  zip.addFile('reproduce.sh', Buffer.from(reproScript));

  // Write bundle
  const bundlePath = options.outputPath || './repro-package.zip';
  zip.writeZip(bundlePath);

  return bundlePath;
}

function generateReproductionScript(results: string): string {
  const data = JSON.parse(results);
  const url = data[0]?.url || 'https://example.com';

  return `#!/bin/bash
# Reproduction script for ${url}
# Generated by Repro-in-a-Box

echo "🚀 Starting reproduction..."

# Check if Playwright is installed
if ! command -v npx &> /dev/null; then
  echo "❌ npx not found. Install Node.js first."
  exit 1
fi

# Run Playwright with HAR replay
npx playwright test --config reproduce.config.ts

echo "✅ Reproduction complete!"
`;
}
```

---

## Week 3-4: Determinism Validation

### Implementation in [TECHNICAL_SPEC.md](./TECHNICAL_SPEC.md#4-har-replay-system)

See HAR Replay System section for complete implementation details.

---

## Week 5: MCP Server & Diff

### MCP Server Implementation

See [TECHNICAL_SPEC.md § 3. MCP Server Architecture](./TECHNICAL_SPEC.md#3-mcp-server-architecture) for complete stdio transport implementation.

### Diff Command

**File: `src/cli/commands/diff.ts`**

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';

export async function diffCommand(scanAPath: string, scanBPath: string) {
  console.log(`🔍 Comparing scans...`);

  const scanA = JSON.parse(
    await fs.readFile(path.join(scanAPath, 'scan-results.json'), 'utf-8')
  );
  const scanB = JSON.parse(
    await fs.readFile(path.join(scanBPath, 'scan-results.json'), 'utf-8')
  );

  // Find new issues
  const issuesA = flattenIssues(scanA);
  const issuesB = flattenIssues(scanB);

  const newIssues = issuesB.filter(
    issueB => !issuesA.some(issueA => isSameIssue(issueA, issueB))
  );

  const fixedIssues = issuesA.filter(
    issueA => !issuesB.some(issueB => isSameIssue(issueA, issueB))
  );

  console.log(`\n📈 New issues: ${newIssues.length}`);
  newIssues.forEach(issue => {
    console.log(`  - [${issue.severity}] ${issue.message}`);
  });

  console.log(`\n📉 Fixed issues: ${fixedIssues.length}`);
  fixedIssues.forEach(issue => {
    console.log(`  - [${issue.severity}] ${issue.message}`);
  });

  if (newIssues.length === 0 && fixedIssues.length === 0) {
    console.log('\n✅ No changes detected');
  }
}

function flattenIssues(scan: any[]): any[] {
  return scan.flatMap(page =>
    page.detectorResults.flatMap((dr: any) => dr.issues || [])
  );
}

function isSameIssue(a: any, b: any): boolean {
  return (
    a.severity === b.severity &&
    a.message === b.message &&
    a.url === b.url
  );
}
```

---

## Week 6: Testing & Polish

### Unit Tests

```bash
npm install -D vitest @vitest/ui
```

**File: `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node'
  }
});
```

**File: `src/detectors/__tests__/js-errors.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JavaScriptErrorDetector } from '../js-errors';
import { Page } from 'playwright';

describe('JavaScriptErrorDetector', () => {
  let detector: JavaScriptErrorDetector;
  let mockPage: any;

  beforeEach(() => {
    detector = new JavaScriptErrorDetector();
    mockPage = {
      on: vi.fn(),
      addInitScript: vi.fn(),
      goto: vi.fn(),
      url: vi.fn(() => 'https://example.com')
    };
  });

  it('should register error listeners on setup', async () => {
    await detector.setup(mockPage as any);
    expect(mockPage.on).toHaveBeenCalledWith('pageerror', expect.any(Function));
    expect(mockPage.on).toHaveBeenCalledWith('console', expect.any(Function));
  });

  it('should collect errors after navigation', async () => {
    await detector.setup(mockPage as any);
    
    // Simulate page error
    const errorHandler = mockPage.on.mock.calls.find(
      call => call[0] === 'pageerror'
    )[1];
    errorHandler(new Error('Test error'));

    await detector.navigate(mockPage as any, 'https://example.com');
    const result = await detector.collect(mockPage as any);

    expect(result.passed).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toContain('Test error');
  });
});
```

### Integration Tests

**File: `tests/integration/scan.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

test('CLI scan command', async () => {
  const { stdout } = await execAsync(
    'node dist/cli/index.js scan https://example.com --max-pages 1'
  );

  expect(stdout).toContain('Scanning https://example.com');
  expect(stdout).toContain('Scan complete');
});
```

### Documentation

**File: `README.md`**

```markdown
# Repro-in-a-Box v2

> Find bugs. Freeze them. Ship them.

Autonomous QA agent that scans your website, detects bugs, and packages perfect reproductions.

## Quick Start

\`\`\`bash
npm install -g repro-in-a-box

# Scan a website
repro scan https://yoursite.com

# Validate reproduction
repro validate ./repro-output

# Compare scans
repro diff ./scan-before ./scan-after
\`\`\`

## Features

- 🔍 **7 Bug Detectors**: JS errors, network failures, broken assets, accessibility, web vitals, mixed content, broken links
- 🎯 **Deterministic Replay**: HAR-based network mocking for perfect reproductions
- 🤖 **MCP Integration**: Use as Claude Code tool
- 📦 **Auto-Bundling**: One-click reproduction packages
- 🐳 **Docker Ready**: Works in any environment

## Detectors

| Detector | Description |
|----------|-------------|
| `js-errors` | JavaScript errors and unhandled rejections |
| `network-errors` | Failed network requests |
| `broken-assets` | Missing images, CSS, scripts |
| `accessibility` | WCAG 2.1 AA violations |
| `web-vitals` | LCP, INP, CLS metrics |
| `mixed-content` | HTTP resources on HTTPS |
| `broken-links` | 404s and dead links |

## Documentation

- [Technical Specification](./TECHNICAL_SPEC.md)
- [Implementation Guide](./IMPLEMENTATION_GUIDE.md)
- [Action Plan](./ACTION_PLAN.md)

## License

MIT
\`\`\`

---

## Next Steps

1. ✅ Complete Week 0 validation
2. Execute Week 1-6 build plan
3. Publish to npm
4. Create demo video
5. Share on Twitter/HN

**You're ready to build! 🚀**
