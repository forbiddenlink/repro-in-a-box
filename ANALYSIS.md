# Repro-in-a-Box v2: Comprehensive Analysis & Improvement Plan

**Date:** February 15, 2026  
**Reviewer:** Technical Architecture Analysis  
**Document Type:** Pre-Implementation Review

---

## Executive Summary

**Overall Assessment: 🟢 STRONG FOUNDATION WITH CRITICAL IMPROVEMENTS NEEDED**

Your v2 plan is **architecturally sound** and addresses a real gap in the market. The autonomous scanning feature transforms this from a "packaging tool" into a "QA agent platform." However, there are **implementation risks**, **missing technical details**, and **positioning opportunities** that need attention before you start building.

**Key Strengths:**
- ✅ Clear value proposition: "Find bugs. Freeze them. Ship them."
- ✅ MCP-first design positions you at bleeding edge
- ✅ Detector plugin architecture enables extensibility
- ✅ Strong technical choices (Playwright, TypeScript, Docker)
- ✅ Realistic 5-week timeline with buffer

**Critical Gaps:**
- ❌ HAR replay reliability not addressed (major determinism risk)
- ❌ Web Vitals measurement accuracy concerns
- ❌ No strategy for dynamic content/SPAs
- ❌ Missing crawler politeness/rate limiting
- ❌ Redaction pattern coverage incomplete
- ❌ No plan for test maintenance over time

---

## 1. Technical Architecture Deep Dive

### 1.1 Crawler Design ⚠️ NEEDS HARDENING

**Current Plan:**
```typescript
while (queue.length > 0 && visited.size < options.maxPages) {
  const url = queue.shift()!;
  // ... scan page, discover links
}
```

**Issues:**

1. **No Rate Limiting** — Will hammer the target site. Add crawl delays:
   ```typescript
   crawlDelay: number = 1000, // ms between requests
   respectRobotsTxt: boolean = true,
   ```

2. **No Depth Limiting** — Could get lost in infinite link loops (pagination, calendar widgets). Add:
   ```typescript
   maxDepth: number = 3, // from start URL
   ```

3. **No URL Normalization** — Will treat `https://example.com/page` and `https://example.com/page?utm_source=twitter` as different pages. Add canonical URL logic.

4. **No SPA Support** — Single-page apps won't discover routes via `<a>` tags. You need:
   - Sitemap.xml parsing as fallback
   - Option to manually specify routes via config file
   - Client-side routing detection (watch for `pushState`/`replaceState`)

5. **No Error Recovery** — If one page crashes Playwright, the whole scan stops. Wrap in try-catch, continue on errors.

**Recommended Changes:**

```typescript
interface CrawlOptions {
  url: string;
  maxPages: number;
  maxDepth: number; // ★ NEW
  crawlDelay: number; // ★ NEW (ms)
  respectRobotsTxt: boolean;
  sitemapUrl?: string; // ★ NEW: fallback for SPAs
  routeConfig?: string[]; // ★ NEW: manual routes
  storageState?: string;
  detectors: string[];
}

// Add to crawler.ts
async function shouldCrawlUrl(
  url: string,
  baseUrl: string,
  robotsTxt: RobotsTxtParser
): Promise<boolean> {
  if (!url.startsWith(baseUrl)) return false;
  if (!robotsTxt.canCrawl(url)) return false;
  return true;
}

// Rate limiting
await page.waitForTimeout(options.crawlDelay);
```

### 1.2 Detector Framework 🟢 SOLID DESIGN

**Strengths:**
- Clean separation: `setup()` → `navigate()` → `collect()`
- Extensible registry pattern
- Each detector is independent

**Improvements:**

1. **Add Timeout Protection** — Some detectors (web vitals) wait for metrics. Add per-detector timeouts:
   ```typescript
   interface Detector {
     name: string;
     timeout?: number; // ms, defaults to 30s
     setup(page: Page): Promise<void>;
     collect(page: Page): Promise<Finding[]>;
   }
   ```

2. **Add Detector Dependencies** — Some detectors might need others to run first (e.g., a "performance budget" detector depends on web vitals). Add:
   ```typescript
   interface Detector {
     dependencies?: string[]; // run these detectors first
   }
   ```

3. **Add Filtering** — Not all findings are actionable. Add severity thresholds:
   ```typescript
   interface DetectorConfig {
     name: string;
     enabled: boolean;
     minSeverity?: 'critical' | 'serious' | 'moderate' | 'minor';
   }
   ```

### 1.3 Web Vitals Detector ⚠️ ACCURACY CONCERNS

**Current Plan:** Inject PerformanceObserver before page load.

**Issues:**

1. **INP Measurement Wrong** — Your code uses `processingStart - startTime`, but INP is the **98th percentile** of all interactions, not the max. You need:
   ```typescript
   const interactions: number[] = [];
   new PerformanceObserver((list) => {
     for (const entry of list.getEntries() as PerformanceEventTiming[]) {
       const delay = entry.processingStart - entry.startTime;
       interactions.push(delay);
     }
   }).observe({ type: 'event', buffered: true, durationThreshold: 40 });

   // At collect time:
   const inp = interactions.length === 0 ? 0 : 
     interactions.sort((a, b) => a - b)[Math.floor(interactions.length * 0.98)];
   ```

2. **CLS Incomplete** — You're summing all layout shifts, but CLS uses **session windows** (5s window with max 1s gap). See [web.dev CLS definition](https://web.dev/cls/).

3. **Navigation vs SPA** — Your PerformanceObserver only measures initial page load. SPAs have multiple "soft navigations" that reset vitals. Consider:
   ```typescript
   // Detect SPA navigation
   page.evaluate(() => {
     const originalPushState = history.pushState;
     history.pushState = function(...args) {
       // Reset vitals collectors
       (window as any).__vitals = { LCP: 0, CLS: 0, INP: 0 };
       return originalPushState.apply(this, args);
     };
   });
   ```

4. **Thresholds Are Outdated** — INP threshold changed from 300ms → 200ms in 2024. Source from web.dev dynamically or document version.

**Recommended Fix:**

Use the official `web-vitals` library instead of rolling your own:

```typescript
// package.json
"dependencies": {
  "web-vitals": "^4.0.0"
}

// web-vitals.ts detector
await page.addInitScript(() => {
  import('https://unpkg.com/web-vitals@4/dist/web-vitals.iife.js').then(({ onCLS, onLCP, onINP, onFCP, onTTFB }) => {
    (window as any).__vitals = {};
    onCLS((metric) => (window as any).__vitals.CLS = metric.value);
    onLCP((metric) => (window as any).__vitals.LCP = metric.value);
    onINP((metric) => (window as any).__vitals.INP = metric.value);
    onFCP((metric) => (window as any).__vitals.FCP = metric.value);
    onTTFB((metric) => (window as any).__vitals.TTFB = metric.value);
  });
});
```

This handles all the edge cases correctly.

### 1.4 Determinism Engine ⚠️ HAR REPLAY RISK

**Current Plan:** Record HAR, replay inside Docker with `--network=none`, run 3x, compare.

**Critical Issue:** Playwright does **not natively support HAR replay**. You're relying on the experimental `page.routeFromHAR()` API which:
- Is marked as "experimental" in Playwright docs
- Has known issues with:
  - POST request body matching
  - WebSocket connections
  - Streaming responses
  - CORS preflight requests
  - Redirects
  - Binary content (images, fonts)

**Risk Level:** 🔴 HIGH — This is your core value proposition. If HAR replay flakes, determinism scores suffer and the tool loses credibility.

**Mitigation Strategies:**

1. **Fallback to Mock Service Worker (MSW)**  
   Instead of HAR replay, use MSW to intercept and mock network at the service worker level:
   ```typescript
   // Install msw as dev dep
   // Generate MSW handlers from HAR
   function harToMswHandlers(har: Har): RequestHandler[] {
     return har.entries.map(entry => {
       return rest[entry.request.method.toLowerCase()](
         entry.request.url,
         (req, res, ctx) => {
           return res(
             ctx.status(entry.response.status),
             ctx.body(entry.response.content.text)
           );
         }
       );
     });
   }
   ```
   MSW is battle-tested and handles edge cases better.

2. **Document Known Limitations**  
   Be upfront in docs: "Determinism works for 90% of cases. Known issues: WebSockets, streaming, file uploads."

3. **Add Determinism Confidence Levels**  
   ```typescript
   interface DeterminismResult {
     score: number; // 0-1
     confidence: 'high' | 'medium' | 'low'; // based on HAR complexity
     warnings: string[]; // "WebSocket detected — may be non-deterministic"
   }
   ```

4. **Test Against Real Sites**  
   During Week 3, test against 10+ popular sites (GitHub, Twitter, Reddit, Stripe). Document success rate. If < 70%, reconsider HAR approach.

**Alternative Approach:**

Skip HAR replay entirely for v1. Instead:
- Use `page.route()` to mock specific APIs that change (time, random IDs, auth tokens)
- Focus on "UI determinism" (same clicks produce same DOM state) vs "network determinism"
- Document: "Requires test author to manually stub dynamic APIs"

This trades automation for reliability.

### 1.5 Redactor ⚠️ INCOMPLETE PATTERNS

**Current Plan:** Pattern matching for tokens, emails, API keys.

**Missing Patterns:**

1. **Credit Cards** — Luhn algorithm validation
2. **SSNs** — `\b\d{3}-\d{2}-\d{4}\b`
3. **Phone Numbers** — International formats
4. **Bearer Tokens** — `Authorization: Bearer ...`
5. **AWS Keys** — `AKIA[0-9A-Z]{16}`
6. **Private IPs** — `192.168.x.x`, `10.x.x.x` (not just `.env` values)
7. **MongoDB URLs** — `mongodb://...`
8. **Database Passwords** — `postgres://user:pass@host`

**Recommended:** Use an existing library like `redact-secrets` or `secrets-sanitizer` instead of rolling your own.

```typescript
import { redact } from 'redact-secrets';

function redactHar(har: Har): Har {
  const harString = JSON.stringify(har);
  const redacted = redact(harString, {
    replacement: '[REDACTED]',
    patterns: ['email', 'phone', 'creditCard', 'ssn', 'apiKey']
  });
  return JSON.parse(redacted);
}
```

### 1.6 MCP Server Design 🟢 EXCELLENT

Your MCP integration is well thought out. A few enhancements:

1. **Streaming Support** — For `repro_scan`, crawling can take minutes. Add streaming:
   ```typescript
   server.tool('repro_scan', schema, async function* ({ url, maxPages }) {
     for await (const pageResult of crawlGenerator(url, maxPages)) {
       yield {
         content: [{ type: 'text', text: JSON.stringify(pageResult) }]
       };
     }
   });
   ```

2. **Tool Chaining** — Add a `repro_full_pipeline` tool that orchestrates scan → validate → pack:
   ```typescript
   server.tool('repro_full_pipeline', schema, async ({ url }) => {
     const scan = await scan({ url });
     const bundles = await autoBundleFindings(scan);
     const validated = await Promise.all(
       bundles.map(b => validate(b.path))
     );
     const packed = await Promise.all(
       validated.filter(v => v.score > 0.8).map(v => pack(v.path))
     );
     return { bundles: packed };
   });
   ```

3. **Progress Callbacks** — MCP supports progress notifications. Use them for long-running operations.

---

## 2. Implementation Risks

### 2.1 Schedule Analysis

**Week 1-2:** Low risk. Detectors are straightforward.  
**Week 3:** 🔴 HIGH RISK — Determinism + HAR replay. Budget 2 weeks instead of 1.  
**Week 4:** Medium risk — MCP server is straightforward if you follow SDK patterns.  
**Week 5:** Buffer is adequate.

**Revised Schedule Recommendation:**

| Week | Focus | Risk |
|------|-------|------|
| 1 | Foundation + Simple Detectors | Low |
| 2 | Scan Command + Complex Detectors | Low |
| 3 | **Determinism Research & Prototyping** | 🔴 HIGH |
| 4 | Determinism Implementation + Validate Command | Medium |
| 5 | Pack + Report + MCP Server | Medium |
| 6 | Polish + Testing | Low |

**Add 1 week to account for HAR replay complexity.**

### 2.2 Dependency Risks

| Dependency | Risk | Mitigation |
|------------|------|------------|
| `@axe-core/playwright` | Low | Well-maintained, 1.6M weekly downloads |
| `playwright` (HAR replay) | 🔴 HIGH | Use MSW instead or document limitations |
| `@modelcontextprotocol/sdk` | Medium | New (2024), but official Microsoft SDK |
| `web-vitals` | Low | Official Google library |
| `archiver` (zip) | Low | Battle-tested |

### 2.3 Playwright Version Lock

Don't use `^1.50.0` — lock to exact version `1.50.0`:

```json
"dependencies": {
  "playwright": "1.50.0", // no caret
}
```

Playwright releases every 2 weeks. Breaking changes are common. Lock for determinism.

---

## 3. Missing Features

### 3.1 Test Maintenance Strategy

**Problem:** Tests go stale. URLs change, UI changes, APIs change. Your bundles will break over time.

**Solution:** Add a `repro refresh` command that re-runs the scan on the same URLs and updates the bundle:

```bash
$ repro refresh repro-dashboard-js-error/

🔍 Re-scanning /dashboard...
❌ Original bug still present: TypeError: Cannot read property 'map'
✅ Bundle is still valid

💾 Updated bundle with latest trace + HAR
```

### 3.2 Config File Support

**Problem:** CLI args get verbose:

```bash
repro scan https://... --max-pages 50 --detectors js-errors,a11y --auth-state .repro/auth.json --ignore-urls /admin,/api/internal
```

**Solution:** Add `.reprorc.json`:

```json
{
  "scan": {
    "maxPages": 50,
    "detectors": ["js-errors", "network-errors", "accessibility"],
    "authStatePath": ".repro/auth-state.json",
    "ignorePatterns": ["/admin/*", "/api/internal/*"],
    "crawlDelay": 1000
  },
  "validate": {
    "runs": 5,
    "timeout": 60000
  },
  "redaction": {
    "patterns": ["email", "apiKey", "phone"]
  }
}
```

### 3.3 Baseline Comparison

**Problem:** You have `repro diff` for comparing two scans, but no way to mark one as "baseline" for regression testing.

**Solution:** Add a `--baseline` flag to `repro scan`:

```bash
$ repro scan https://prod.example.com --save-baseline prod-baseline.json

# Later, after deploy:
$ repro scan https://prod.example.com --compare-to prod-baseline.json

📊 Comparison to baseline:
  New Issues: 2
  Resolved Issues: 0
  Regression Detected ⚠
```

### 3.4 CI Integration Documentation

**Problem:** Your demo shows GitHub Action generation, but real CI integration has nuances (secrets, artifacts, parallelization).

**Solution:** Include example workflows for:
- GitHub Actions (with matrix sharding)
- GitLab CI
- CircleCI
- Jenkins

### 3.5 False Positive Management

**Problem:** Some "errors" are expected (e.g., 401 on `/admin` when not logged in). Users need to suppress them.

**Solution:** Add ignore rules:

```json
{
  "scan": {
    "ignore": [
      { "type": "network-error", "url": "/admin", "status": 401 },
      { "type": "accessibility", "ruleId": "color-contrast", "selector": ".hero" }
    ]
  }
}
```

---

## 4. Tech Stack Validation

### 4.1 Approved Choices ✅

| Choice | Verdict | Reasoning |
|--------|---------|-----------|
| TypeScript | ✅ SOLID | Playwright-native, MCP SDK is TS-first |
| `commander` + `inquirer` | ✅ SOLID | Industry standard CLI tools |
| Playwright | ✅ SOLID | Best-in-class browser automation |
| Docker | ✅ SOLID | Standard for reproducibility |
| `@axe-core/playwright` | ✅ SOLID | 1.6M weekly downloads, official Deque integration |
| `@modelcontextprotocol/sdk` | ⚠️ ACCEPTABLE | New, but official Microsoft backing |
| Handlebars | ✅ SOLID | Simple, logic-less templating |
| `tsup` | ✅ SOLID | Fast, zero-config bundler |
| `pnpm` | ✅ SOLID | Workspace support, fast |

### 4.2 Additions Recommended

1. **`web-vitals`** — Replace custom PerformanceObserver logic  
   `npm install web-vitals`

2. **`zod`** — You're using it for MCP, use it everywhere for runtime validation  
   `npm install zod`

3. **`robots-parser`** — For robots.txt respect  
   `npm install robots-parser`

4. **`chalk`** — For colored terminal output (you list it, but not in examples)  
   Already in your list ✅

5. **`redact-secrets`** — For comprehensive secret scrubbing  
   `npm install redact-secrets`

6. **`msw`** — If you go the MSW route for determinism  
   `npm install -D msw`

### 4.3 Alternatives Considered

| Alternative | Instead Of | Verdict |
|-------------|-----------|---------|
| Puppeteer | Playwright | ❌ REJECT — No HAR/trace out-of-box |
| Cypress | Playwright | ❌ REJECT — Not headless-first, no MCP patterns |
| Selenium | Playwright | ❌ REJECT — Outdated API |
| `oclif` | `commander` | ⚠️ CONSIDER — More opinionated but powerful CLI framework. If you want features like plugins, auto-docs, and complex subcommands, consider it. |

---

## 5. Market Positioning & Differentiation

### 5.1 Competitive Landscape (Updated)

| Feature | Replay.io | Jam.dev | Checkly | **Repro-in-a-Box** |
|---------|-----------|---------|---------|-------------------|
| **Autonomous Bug Finding** | ✗ | ✗ | ✗ | ✓ (7 detectors) |
| **Portable Repro Bundle** | ✗ (proprietary) | ✗ (video) | ✗ (cloud) | ✓ (Docker + HAR) |
| **Determinism Validation** | ✗ | ✗ | ✗ | ✓ (scored) |
| **MCP/AI Integration** | ✗ | ✗ | ✗ | ✓ (5 tools) |
| **Open Source** | ✗ | ✗ | ✗ | ✓ |
| **One CLI Install** | ✗ | ✗ | ✗ | ✓ |
| **Accessibility Built-in** | ✗ | ✗ | ✓ | ✓ |
| **Core Web Vitals** | ✗ | ✗ | ✓ | ✓ |
| **Network Mocking** | ✓ (replay) | ✗ | ✗ | ✓ (HAR) |
| **Free Tier** | ✓ (limited) | ✓ (limited) | ✓ (50 runs) | ✓ (unlimited) |

**New Competitor to Watch:** [Checkly](https://www.checklyhq.com/) — Does autonomous monitoring with Playwright, but cloud-only and no repro packaging.

### 5.2 Positioning Refinement

**Current tagline:** "Find bugs. Freeze them. Ship them."  
**Better tagline:** "One command. Every bug. Portable, deterministic, AI-ready."

Emphasize:
1. **One command** (vs multi-step competitors)
2. **Every bug** (7+ detectors, not just crashes)
3. **Portable** (Docker, not SaaS lock-in)
4. **Deterministic** (guaranteed reproducibility)
5. **AI-ready** (MCP integration)

### 5.3 Target Audiences

**Primary:**
- **Indie hackers / bootstrapped startups** — Free, self-hosted, no SaaS pricing
- **Open-source maintainers** — Portable repros for GitHub issues
- **AI agent developers** — MCP toolkit for automated QA

**Secondary:**
- **Enterprise QA teams** — Self-hosted alternative to SaaS
- **Consultants** — Deliver repro bundles to clients

**Avoid competing on:**
- Enterprise features (SSO, RBAC) — stick to developer tool
- Advanced test authoring — keep it simple, focus on packaging

---

## 6. Recommended Improvements (Prioritized)

### Priority 1: Must-Fix Before Launch

1. **HAR Replay Alternative** — Research MSW or document limitations clearly
2. **Web Vitals Accuracy** — Use official `web-vitals` library
3. **Crawler Rate Limiting** — Add delays, respect robots.txt
4. **Redaction Coverage** — Use `redact-secrets` library
5. **Add 1 Week to Schedule** — For determinism prototyping

### Priority 2: High-Value Enhancements

6. **Config File Support** (`.reprorc.json`) — Improves DX
7. **False Positive Suppression** — Ignore rules for noise reduction
8. **SPA Support** — Sitemap parsing + manual routes
9. **Test Refresh Command** — `repro refresh` for maintenance
10. **Streaming MCP Tools** — For better AI agent UX

### Priority 3: Post-MVP

11. **Visual Regression Detector** — Screenshot diffing (Week 6+)
12. **`repro shrink`** — Delta debugging minimizer (original v1 plan)
13. **Playwright Agents Integration** — Natural language test generation
14. **Multi-environment Diff** — Compare prod vs staging vs local
15. **Plugin System** — Let users write custom detectors

---

## 7. Risk Mitigation Checklist

Before starting implementation:

- [ ] **Prototype HAR replay** — Test against 5 sites, measure success rate
- [ ] **Lock Playwright version** — Change `^1.50.0` → `1.50.0`
- [ ] **Research MSW integration** — As fallback to HAR replay
- [ ] **Add web-vitals dependency** — Don't roll your own metrics
- [ ] **Document known limitations** — Be upfront about edge cases
- [ ] **Create .reprorc.json schema** — Plan config structure
- [ ] **Test axe-core false positives** — Run against real sites, measure noise
- [ ] **Research robots.txt parsing** — Use `robots-parser` library
- [ ] **Plan fail-fast on Docker errors** — Validation failures should be loud
- [ ] **Add CI examples** — GitHub Actions, GitLab CI, CircleCI templates

---

## 8. Architecture Diagram (Revised)

```
┌─────────────────────────────────────────────────────────────┐
│                   repro CLI (TypeScript)                     │
│                                                             │
│  ┌────────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │   scan     │  │  login   │  │ validate │  │   pack   │  │
│  │           │  │          │  │          │  │          │  │
│  │ Crawl +   │  │ Storage  │  │ Docker + │  │ Redact + │  │
│  │ 7 Detect. │  │ State +  │  │ HAR/MSW +│  │ Bundle + │  │
│  │ + Auto-   │  │ Auth     │  │ 3x Run + │  │ Report + │  │
│  │ Bundle    │  │          │  │ Score    │  │ GH Action│  │
│  └──────┬─────┘  └──────────┘  └──────────┘  └──────────┘  │
│         │                                                   │
│         │ (findings) ───────────┐                          │
│         │                       ▼                          │
│  ┌──────────────────────┐  ┌──────────────────┐           │
│  │ Severity Scoring     │  │  Config Loader   │           │
│  │ (Page importance +   │  │  (.reprorc.json) │           │
│  │  Type weighting)     │  │                  │           │
│  └──────────────────────┘  └──────────────────┘           │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │   diff   │  │  record  │  │ refresh  │  │  serve   │  │
│  │         │  │          │  │          │  │  (MCP)   │  │
│  │ Compare │  │ Manual   │  │ Re-run   │  │          │  │
│  │ Two     │  │ Session +│  │ Scan +   │  │ Stream + │  │
│  │ Scans + │  │ HAR +    │  │ Update   │  │ Pipeline │  │
│  │ Trend   │  │ Trace    │  │ Bundle   │  │ Tools    │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
            ┌────────────────────────┐
            │  Detector Registry     │
            │                        │
            │  1. JS Errors          │
            │  2. Network Errors     │
            │  3. Broken Assets      │
            │  4. Broken Links       │
            │  5. Web Vitals (lib)   │ ◄──┐ Use web-vitals npm
            │  6. Accessibility      │    │ instead of custom
            │  7. Mixed Content      │    │
            │                        │    │
            │  + Plugin API for      │    │
            │    custom detectors    │    │
            └────────────────────────┘    │
                                          │
                                          │
            ┌────────────────────────┐    │
            │  Determinism Engine    │    │
            │                        │    │
            │  Option A: HAR Replay  │◄───┘ RISK: Prototype first
            │  (experimental)        │
            │                        │
            │  Option B: MSW         │◄──── FALLBACK: More reliable
            │  (battle-tested)       │
            │                        │
            │  Confidence Scoring +  │
            │  Warning Detection     │
            └────────────────────────┘
```

---

## 9. Demo Script (Improved)

**Original problem:** Demo assumes everything works perfectly. Real demo will hit edge cases.

**Improved Demo Flow:**

```bash
# 0. Setup (pre-record this if live demo)
$ npm install -g repro-in-a-box
$ repro login https://demo-app.example.com/login
# [Log in manually, close browser]
✅ Auth state saved

# 1. Scan (LIVE)
$ repro scan https://demo-app.example.com --max-pages 10

# Expected output (show real terminal):
🔍 Scanning demo-app.example.com...
  Crawling... 10/10 pages

  / ✓ clean
  /dashboard
    🔴 JS Error: TypeError: Cannot read property 'map' of undefined
    🟡 LCP: 4.2s (threshold: 2.5s)
  /settings
    🔴 A11y: 2 critical — missing alt text, no form labels
  ...

📊 Scan Summary
  Pages scanned:    10
  Pages with issues: 3
  🔴 Critical:  2
  🟡 Warning:   3

? Auto-generate bundles? Yes
  ✅ repro-dashboard-js-error/
  ✅ repro-settings-a11y/

# 2. Validate (LIVE — but use pre-validated bundle if flaky)
$ repro validate repro-dashboard-js-error/

🐳 Building container... done
🔁 Run 1/3: ❌ Test failed (TypeError: Cannot read property 'map')
🔁 Run 2/3: ❌ Test failed (same error)
🔁 Run 3/3: ❌ Test failed (same error)

📊 Determinism Score: 3/3 (100%) — DETERMINISTIC ✓

# 3. Pack (LIVE)
$ repro pack repro-dashboard-js-error/

🔒 Redacting secrets... 4 items redacted
📦 Bundling... repro-dashboard-js-error.zip
📄 Generating report... scan-report.html
✅ GitHub Action created: .github/workflows/repro-check.yml

# 4. Share (SHOW pre-generated HTML)
[Open scan-report.html in browser — full-screen this]

# 5. AI Agent Integration (SCRIPTED — don't do live)
[Screen recording of Claude Code:]
> User: "Scan my staging site and list critical bugs"
> Claude: [calls repro_scan MCP tool] "Found 2 critical bugs:
>   1. JS error on /dashboard
>   2. Broken image on /settings
>   Would you like me to investigate the source code?"

# 6. Portable Validation (PRE-RECORDED video if no second machine)
[Video showing: Download zip → Extract → docker compose up → Test fails identically]

CLOSING:
"That's Repro-in-a-Box. One command, every bug, portable forever."
```

**Key:** Have backup recordings for steps 5-6 in case of live demo failures.

---

## 10. Final Recommendations

### What to Do Before Starting:

1. **Prototype HAR replay this week** — Spend 2 days testing `page.routeFromHAR()` against 10 sites. Measure success rate. If < 70%, pivot to MSW.

2. **Write a pre-mortem** — List all the ways this could fail (HAR flakiness, web vitals inaccuracy, scan too slow). Then add tests/safeguards for each.

3. **Create a "known limitations" doc** — Be upfront: "v1 doesn't support WebSockets, streaming responses, or client-side routing." Users respect honesty.

4. **Add dependency locks** — Pin Playwright to exact version. Add `package-lock.json` / `pnpm-lock.yaml` to git.

5. **Set up dogfooding** — Scan your own project's website weekly during development. Eat your own dog food.

### What to Skip (For Now):

1. **Visual regression** — Complex, low ROI for v1. Add later.
2. **Delta debugging (`shrink`)** — Cool but not MVP. Save for v1.2.
3. **Plugin marketplace** — YAGNI. Wait for user demand.
4. **Multi-browser support** — Chromium-only for v1. Firefox/WebKit later.
5. **Cloud hosting** — Stay local/self-hosted. Don't compete with SaaS until product-market fit.

### What's Actually Impressive to Employers:

- **Systems integration** (Playwright + Docker + axe + CDP + HAR + MCP)
- **Determinism engineering** (hard problem, creative solution)
- **MCP-first design** (bleeding edge, AI agent ready)
- **Real-world testing** (dogfood on 10+ sites, document successes)
- **Open-source community building** (GitHub stars, issues, contributions)

**NOT impressive:**
- Building yet another Playwright wrapper
- Claiming "100% determinism" without proof
- Feature bloat before PMF

---

## 11. Go / No-Go Checklist

Before committing to 5 weeks of development:

### Technical Feasibility ✅
- [ ] HAR replay prototyped and success rate measured
- [ ] Docker build tested on macOS, Linux, Windows
- [ ] MCP SDK tested with Claude Code or Cursor
- [ ] Playwright version locked and tested
- [ ] All detector examples run successfully

### Market Validation ⚠️
- [ ] 5+ potential users interviewed
- [ ] Competitor tools tested firsthand (Replay.io, Jam.dev)
- [ ] GitHub search for similar projects (none found or differentiated)
- [ ] r/webdev or HN feedback on idea (optional but recommended)

### Resource Commitment ✅
- [ ] 5-6 weeks of full-time availability
- [ ] Budget for occasional SaaS costs (Perplexity, testing services)
- [ ] Backup plan if one component fails (e.g., HAR → MSW pivot)

### Post-Launch Plan ⚠️
- [ ] Documentation site ready (README, docs/, examples/)
- [ ] Demo video recorded and edited
- [ ] Launch strategy (HN Show HN, r/webdev, Twitter)
- [ ] Support plan (GitHub Issues, Discord, email)

**Verdict:** 🟢 GO — with modifications above.

---

## 12. Conclusion

**You have a strong foundation.** The autonomous scanning + MCP integration is genuinely novel. But HAR replay determinism is your biggest risk. Budget extra time to validate that piece, and have a fallback plan (MSW or manual mocking).

**This tool could be portfolio gold** — if you nail the demo, document the hard parts (determinism algorithm, severity scoring), and dogfood it on real sites.

**Ship fast, but ship correct.** It's better to launch with 5 detectors that work than 7 detectors that flake.

You've got this. Now go prototype HAR replay before you write a single detector. 🚀

---

**Next Steps:**
1. Review this document
2. Prototype HAR replay (2 days)
3. If success rate > 70%, proceed with original plan
4. If success rate < 70%, revise determinism strategy (pivot to MSW or manual mocking)
5. Update build schedule based on findings
6. Create GitHub repo and start Week 1

**Questions for you:**
- Have you tested `page.routeFromHAR()` yet? If not, start there.
- Do you have access to 10+ test sites (staging environments, personal projects)?
- Are you planning to monetize eventually, or purely OSS?

Good luck! 🎯
