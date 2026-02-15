# Repro-in-a-Box v2: Project Overview

**Tagline:** Find bugs. Freeze them. Ship them.  
**Status:** 🟢 Ready to Build  
**Start Here:** [BUILD_CHECKLIST.md](./BUILD_CHECKLIST.md)

---

## What Is This?

Repro-in-a-Box v2 is an **autonomous QA agent** that:

1. **Crawls your website** — Discovers pages automatically
2. **Runs 7 bug detectors** — JavaScript errors, network failures, broken assets, accessibility, web vitals, mixed content, broken links
3. **Validates determinism** — HAR-based replay ensures bugs are reproducible
4. **Packages reproductions** — One-click Docker bundles for bug reports
5. **Integrates with Claude** — MCP server for AI-assisted QA

**Target Users:** Developers, QA engineers, portfolio projects, AI-first tooling enthusiasts

---

## Tech Stack

| Category | Technology | Version | Rationale |
|----------|------------|---------|-----------|
| **Runtime** | Node.js | 20+ | Modern async/await, ESM support |
| **Language** | TypeScript | 5.3.0 | Type safety, better DX |
| **Browser Automation** | Playwright | **1.50.0 (locked)** | HAR replay via `page.routeFromHAR()` |
| **Web Vitals** | `web-vitals` | 5.1.0 | Official Google library (14M weekly downloads) |
| **Accessibility** | `@axe-core/playwright` | 4.11.1 | WCAG 2.1 AA compliance (1.6M weekly downloads) |
| **MCP SDK** | `@modelcontextprotocol/sdk` | 1.x stable | stdio transport (simpler than HTTP) |
| **CLI** | Commander | 12.0.0 | Mature CLI framework |
| **Testing** | Vitest | 1.2.0 | Fast unit testing |
| **Packaging** | Docker | Latest | Cross-platform reproduction |

---

## Project Structure

```
repro-in-a-box/
├── docs/                           # Planning documents (you are here)
│   ├── ANALYSIS.md                 # 8,900-word technical review
│   ├── ACTION_PLAN.md              # 6-week phased plan
│   ├── TECHNICAL_SPEC.md           # Complete implementation specs
│   ├── IMPLEMENTATION_GUIDE.md     # Step-by-step build guide
│   ├── BUILD_CHECKLIST.md          # Ready-to-execute checklist
│   └── PROJECT_OVERVIEW.md         # This file
│
├── src/                            # Source code (to be created)
│   ├── detectors/                  # Bug detection engines
│   │   ├── base.ts                 # Detector interface
│   │   ├── registry.ts             # Detector registry
│   │   ├── js-errors.ts            # JavaScript error detector
│   │   ├── network-errors.ts       # Network failure detector
│   │   ├── broken-assets.ts        # Broken asset detector
│   │   ├── accessibility.ts        # Accessibility detector
│   │   ├── web-vitals.ts           # Web Vitals detector
│   │   ├── mixed-content.ts        # Mixed content detector
│   │   └── broken-links.ts         # Broken links detector
│   │
│   ├── crawler/                    # Website crawler
│   │   └── crawler.ts              # Multi-page crawling logic
│   │
│   ├── determinism/                # HAR recording/replay
│   │   ├── har-recorder.ts         # Record network traffic
│   │   └── har-replayer.ts         # Replay from HAR files
│   │
│   ├── bundler/                    # Reproduction packager
│   │   └── bundler.ts              # Create Docker bundles
│   │
│   ├── mcp/                        # MCP server
│   │   ├── server.ts               # MCP server implementation
│   │   └── index.ts                # Entry point for stdio transport
│   │
│   └── cli/                        # CLI interface
│       ├── index.ts                # Commander setup
│       └── commands/
│           ├── scan.ts             # Scan command
│           ├── validate.ts         # Validate command
│           └── diff.ts             # Diff command
│
├── tests/                          # Test suite
│   ├── integration/                # Integration tests
│   └── e2e/                        # End-to-end tests
│
├── test-har-replay.ts              # Week 0 validation script (CRITICAL)
├── package.json                    # Dependencies
├── tsconfig.json                   # TypeScript config
├── vitest.config.ts                # Test config
├── Dockerfile                      # Docker image for reproductions
└── README.md                       # User-facing documentation
```

---

## Documentation Map

### 📚 Read These In Order

1. **[ANALYSIS.md](./ANALYSIS.md)** *(8,900 words)*
   - Comprehensive technical review of v2 plan
   - Architecture deep dive
   - Risk assessment
   - Recommended improvements
   - **Read this first** to understand the "why" behind decisions

2. **[ACTION_PLAN.md](./ACTION_PLAN.md)** *(440 lines)*
   - 6-week phased implementation plan
   - Week 0 validation sprint (CRITICAL)
   - Success metrics
   - Go/no-go criteria
   - **Read this second** for the timeline

3. **[TECHNICAL_SPEC.md](./TECHNICAL_SPEC.md)** *(1,100+ lines)*
   - Complete implementation specifications
   - Code examples for every component
   - Web Vitals integration (official library)
   - MCP server architecture (stdio transport)
   - HAR replay system with fallback
   - Security & redaction patterns
   - **Read this third** for technical details

4. **[IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)** *(1,200+ lines)*
   - Step-by-step build instructions
   - Week-by-week tasks
   - Copy-paste code snippets
   - Testing strategies
   - Troubleshooting guide
   - **Read this fourth** for "how to build"

5. **[BUILD_CHECKLIST.md](./BUILD_CHECKLIST.md)** *(400+ lines)*
   - Ready-to-execute checklist
   - Day-by-day tasks
   - Success criteria
   - Quick reference
   - **Start here when building** ✅

---

## Quick Start (5 Minutes)

### ⚠️ CRITICAL: Do This First

**Week 0 Validation** — Test HAR replay viability (2 days)

```bash
# 1. Initialize project
mkdir repro-in-a-box && cd repro-in-a-box
npm init -y
npm install playwright@1.50.0 tsx

# 2. Copy test script from IMPLEMENTATION_GUIDE.md
# See: ./IMPLEMENTATION_GUIDE.md#day-1-har-replay-prototype

# 3. Run validation
npx tsx test-har-replay.ts

# 4. Review results
cat har-validation-results.json

# 5. Make decision
# ≥70% success → Proceed with HAR replay
# 50-70% success → Hybrid approach (HAR + MSW)
# <50% success → Use MSW only, update docs
```

**🛑 DO NOT START WEEK 1 UNTIL VALIDATION PASSES**

---

## Key Research Findings

### 1. HAR Replay (High Risk)

**Finding:** Playwright's `page.routeFromHAR()` is **experimental** and has documented limitations:

- ❌ WebSocket connections **not supported**
- ❌ POST request bodies **unreliable**
- ❌ Streaming responses **may fail**
- ❌ CORS preflight **can cause issues**
- ❌ Service Workers **not intercepted**

**Mitigation:** Week 0 validation against 10 real sites with ≥70% success threshold.

**Fallback:** Mock Service Worker (MSW) if validation fails.

### 2. Web Vitals (Production-Ready)

**Finding:** Official `web-vitals` library eliminates need for custom code:

- ✅ 14,069,120 weekly downloads
- ✅ 2KB brotli'd
- ✅ Proper INP calculation (replaced FID in March 2024)
- ✅ Attribution build available for debugging
- ✅ Handles edge cases we'd miss

**Decision:** Use `web-vitals` library, not custom PerformanceObserver code.

**Example:**
```typescript
import { onCLS, onINP, onLCP } from 'web-vitals';

onCLS(sendToAnalytics); // Cumulative Layout Shift ≤0.1
onINP(sendToAnalytics); // Interaction to Next Paint ≤200ms
onLCP(sendToAnalytics); // Largest Contentful Paint ≤2.5s
```

### 3. MCP Transport (stdio for v1)

**Finding:** MCP supports two transports:

| Transport | Pros | Cons |
|-----------|------|------|
| **stdio** | ✅ Simple<br>✅ No security concerns<br>✅ Local-only | ❌ Single client<br>❌ Subprocess required |
| **HTTP** | ✅ Multiple clients<br>✅ Remote access | ❌ Requires security (Origin validation, localhost binding, auth)<br>❌ Session management |

**Decision:** Use **stdio** for v1, defer HTTP to v2.

**Why:** stdio is simpler and sufficient for Claude Desktop integration.

### 4. Accessibility Testing (Battle-Tested)

**Finding:** `@axe-core/playwright` is industry-standard:

- ✅ 1,627,428 weekly downloads
- ✅ WCAG 2.1 Level A & AA support
- ✅ Chainable API: `withTags()`, `withRules()`, `include()`, `exclude()`
- ✅ Detailed violation reports with HTML snippets

**Decision:** Use `@axe-core/playwright` for a11y testing.

**Example:**
```typescript
const results = await new AxeBuilder({ page })
  .withTags(['wcag2a', 'wcag2aa'])
  .exclude('#ads')
  .analyze();
```

---

## Architecture Decisions

### Detector Framework

**Pattern:** Plugin architecture with lifecycle hooks

```typescript
interface Detector {
  setup(page: Page): Promise<void>;      // Called once
  navigate(page: Page, url: string): Promise<void>; // Per URL
  collect(page: Page): Promise<DetectorResult>;    // After navigation
}
```

**Benefits:**
- ✅ Extensible — Add new detectors without changing core
- ✅ Testable — Each detector is isolated
- ✅ Composable — Run any combination of detectors

### HAR-Based Determinism

**Pattern:** Record → Replay → Compare

1. **Record:** Capture network traffic to HAR file
2. **Replay:** Replay from HAR (offline, deterministic)
3. **Compare:** Run detectors 3x, verify identical results

**Benefits:**
- ✅ Deterministic — Same inputs → same outputs
- ✅ Offline — No external dependencies
- ✅ Fast — Network served from HAR (no latency)

**Risks:**
- ⚠️ Experimental feature
- ⚠️ Known limitations (WebSockets, POST, streaming)
- ⚠️ Validation required (Week 0)

### MCP Integration

**Pattern:** stdio transport with 3 tools

```json
{
  "tools": [
    { "name": "scan_site", "description": "Scan a website for bugs" },
    { "name": "validate_reproduction", "description": "Validate a repro package" },
    { "name": "diff_scans", "description": "Compare two scans" }
  ]
}
```

**Benefits:**
- ✅ Claude Desktop integration
- ✅ AI-assisted QA workflows
- ✅ No manual tool invocation

---

## Timeline

| Week | Phase | Deliverable |
|------|-------|-------------|
| **Week 0** | Validation | HAR replay viability confirmed (≥70% success) ⚠️ **BLOCKING** |
| **Week 1** | Foundation | Detector framework + 3 basic detectors |
| **Week 2** | Scan Command | CLI working, crawler functional, auto-bundling |
| **Week 3-4** | Determinism | HAR recording/replay + validate command |
| **Week 5** | MCP + Diff | MCP server + diff command |
| **Week 6** | Testing + Polish | Tests, docs, publish to npm |

**Total:** 6 weeks (7 if Week 0 fails)

---

## Success Metrics

### Technical Validation

- [ ] HAR replay ≥70% success rate on 10 diverse sites
- [ ] All 7 detectors functional
- [ ] Scan completes in <2 minutes for 10-page site
- [ ] Validate command achieves >90% determinism score
- [ ] MCP server integrates with Claude Desktop

### User Validation

- [ ] Scan detects at least 1 real bug on 5 test sites
- [ ] Reproduction package runs successfully in Docker
- [ ] Zero false positives on example.com (baseline test)
- [ ] Diff command correctly identifies new/fixed issues

### Portfolio Validation

- [ ] Published to npm
- [ ] GitHub README with demo GIF
- [ ] Documentation complete
- [ ] Positive feedback from 3 early users

---

## Risk Register

| Risk | Severity | Mitigation |
|------|----------|------------|
| **HAR replay fails validation** | 🔴 Critical | Week 0 validation, MSW fallback plan |
| **Playwright 1.50.0 bugs** | 🟡 Medium | Lock version, test extensively, report issues upstream |
| **False positives** | 🟡 Medium | Baseline comparison, whitelisting, tunable thresholds |
| **Performance issues** | 🟢 Low | Rate limiting, depth limiting, parallel processing |

---

## Next Steps

1. ✅ **Review Documents**
   - [ ] Read [ANALYSIS.md](./ANALYSIS.md)
   - [ ] Read [ACTION_PLAN.md](./ACTION_PLAN.md)
   - [ ] Skim [TECHNICAL_SPEC.md](./TECHNICAL_SPEC.md)
   - [ ] Review [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)

2. 🚨 **Execute Week 0 Validation**
   - [ ] Follow [BUILD_CHECKLIST.md § Week 0](./BUILD_CHECKLIST.md#-critical-week-0-validation-blocking)
   - [ ] Run `test-har-replay.ts`
   - [ ] Make go/no-go decision

3. 🚀 **Start Building**
   - [ ] Initialize project (Week 1, Day 1)
   - [ ] Implement detector framework
   - [ ] Build CLI
   - [ ] Add detectors
   - [ ] Integrate MCP

4. 📦 **Launch**
   - [ ] Publish to npm
   - [ ] Share on Twitter/HN
   - [ ] Update portfolio

---

## Questions & Answers

### Why lock Playwright to 1.50.0?

HAR replay via `page.routeFromHAR()` is experimental. Locking to 1.50.0 ensures:
- Known behavior (breaking changes in future versions won't surprise us)
- Consistent testing (Week 0 validation is accurate)
- Controlled upgrades (we decide when to test new versions)

### Why not use Selenium/Puppeteer?

Playwright has the best HAR replay support:
- `page.routeFromHAR()` built-in
- Better async handling
- Modern API
- Active development

### What if HAR replay fails validation?

**Plan B:** Use Mock Service Worker (MSW)
- More reliable (not experimental)
- HTTP/REST request mocking
- Requires more setup (manual route definitions)
- Slightly less deterministic (no WebSocket support either)

### Why stdio over HTTP for MCP?

**v1:** stdio is simpler, no security concerns, works with Claude Desktop.

**v2:** HTTP enables multiple clients, remote access, but requires:
- Origin header validation (DNS rebinding protection)
- Localhost binding (not 0.0.0.0)
- Authentication (bearer tokens, API keys)

Start simple, add complexity later.

### Can this be a portfolio piece?

**Yes!** This project demonstrates:
- ✅ Modern TypeScript/Node.js
- ✅ Playwright browser automation
- ✅ CLI tool development
- ✅ MCP protocol implementation (bleeding-edge)
- ✅ Docker packaging
- ✅ Testing strategies
- ✅ Technical writing (this documentation)

Perfect for "AI-first tooling" or "developer tools" portfolios.

---

## Resources

### Documentation

- [Playwright HAR Replay](https://playwright.dev/docs/api/class-page#page-route-from-har)
- [Web Vitals Library](https://github.com/GoogleChrome/web-vitals)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [@axe-core/playwright](https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright)

### External Links

- [Core Web Vitals](https://web.dev/vitals/)
- [Model Context Protocol Spec](https://spec.modelcontextprotocol.io/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

### Project Files

- [Planning Documents](./docs/)
- [Source Code](./src/) *(to be created)*
- [Tests](./tests/) *(to be created)*

---

## Contact

- **Project:** Repro-in-a-Box v2
- **Status:** Ready to Build 🟢
- **Start Here:** [BUILD_CHECKLIST.md](./BUILD_CHECKLIST.md)

**Let's build this! 🚀**
