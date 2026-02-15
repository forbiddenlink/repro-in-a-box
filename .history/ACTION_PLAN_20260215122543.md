# Repro-in-a-Box v2: Priority Action Plan

**Status:** ⚠️ HOLD — Critical validation needed before starting implementation

---

## 🚨 CRITICAL: Do This First (Before Any Coding)

### Week 0: Validation Sprint (2-3 days)

**Goal:** De-risk the HAR replay determinism assumption

#### Day 1-2: HAR Replay Prototype

```typescript
// test-har-replay.ts
import { chromium } from 'playwright';

async function testHarReplay(url: string) {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Record HAR
  await page.routeFromHAR('recording.har', { 
    url, 
    update: true 
  });
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  await page.close();

  // Replay HAR 3x
  const results: boolean[] = [];
  for (let i = 0; i < 3; i++) {
    const page2 = await context.newPage();
    await page2.routeFromHAR('recording.har', { 
      url, 
      update: false 
    });
    
    try {
      await page2.goto(url, { timeout: 30000 });
      await page2.waitForLoadState('networkidle');
      results.push(true);
    } catch (e) {
      console.error(`Run ${i + 1} failed:`, e.message);
      results.push(false);
    }
    
    await page2.close();
  }

  await browser.close();
  
  const successRate = results.filter(Boolean).length / results.length;
  return { url, successRate, results };
}

// Test against 10 sites
const testSites = [
  'https://example.com',
  'https://github.com',
  'https://news.ycombinator.com',
  'https://reddit.com',
  'https://stackoverflow.com',
  'https://stripe.com/docs',
  'https://playwright.dev',
  'https://twitter.com',
  'https://youtube.com',
  'https://vercel.com'
];

(async () => {
  const results = await Promise.all(
    testSites.map(url => testHarReplay(url))
  );
  
  const avgSuccess = results.reduce((sum, r) => sum + r.successRate, 0) / results.length;
  
  console.log('HAR Replay Test Results');
  console.log('=======================');
  results.forEach(r => {
    console.log(`${r.url}: ${(r.successRate * 100).toFixed(0)}% success`);
  });
  console.log(`\nOverall: ${(avgSuccess * 100).toFixed(0)}% success rate`);
  
  if (avgSuccess < 0.7) {
    console.log('\n⚠️ HAR replay success rate < 70%');
    console.log('Recommendation: Consider MSW alternative');
  } else {
    console.log('\n✅ HAR replay viable — proceed with original plan');
  }
})();
```

**Run it:**
```bash
npx tsx test-har-replay.ts
```

**Decision Tree:**
- **Success rate ≥ 70%:** Proceed with HAR replay + document known limitations
- **Success rate < 70%:** Pivot to MSW-based mocking (see below)
- **Success rate < 50%:** Skip determinism validation for v1, focus on scan/detect

#### Day 3: MSW Fallback Prototype (if needed)

```typescript
// test-msw-alternative.ts
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { chromium } from 'playwright';

async function harToMswHandlers(harPath: string) {
  const har = JSON.parse(fs.readFileSync(harPath, 'utf-8'));
  
  return har.log.entries.map(entry => {
    const { method, url } = entry.request;
    const { status, content } = entry.response;
    
    return http[method.toLowerCase()](url, () => {
      return HttpResponse.text(
        content.text || '',
        { 
          status,
          headers: Object.fromEntries(
            entry.response.headers.map(h => [h.name, h.value])
          )
        }
      );
    });
  });
}

// Test: Record → Convert → Replay
```

---

## ✅ Phase 1: Foundation (If Validation Passes)

### Week 1: Setup + Simple Detectors

**Day 1: Project Scaffold**
```bash
mkdir repro-in-a-box && cd repro-in-a-box
pnpm init
pnpm add playwright@1.50.0 commander inquirer chalk zod
pnpm add -D typescript @types/node tsup vitest
```

**Create:**
- `bin/repro.ts` — CLI entry with subcommands
- `src/types/index.ts` — Shared types (Finding, ReproManifest, etc.)
- `tsconfig.json` — Strict mode
- `tsup.config.ts` — Build config
- `.gitignore`
- `README.md`

**Day 2: Crawler Core**
- `src/core/crawler.ts`
- Add: Rate limiting, robots.txt, depth limiting
- Test with 5 sites

**Day 3: Detector Framework**
- `src/core/detectors/index.ts` — Registry pattern
- `src/core/detectors/js-errors.ts`
- `src/core/detectors/network-errors.ts`
- Test: Run against example.com

**Day 4: More Detectors**
- `src/core/detectors/broken-assets.ts`
- `src/core/detectors/broken-links.ts`
- `src/core/detectors/mixed-content.ts`

**Day 5: Complex Detectors**
- `src/core/detectors/web-vitals.ts` — **Use `web-vitals` npm library**
- `src/core/detectors/accessibility.ts` — `@axe-core/playwright`
- Test all 7 detectors

**Weekend:** Buffer/catchup

---

### Week 2: Scan Command + Auto-Bundle

**Day 1: Scan CLI**
- `src/commands/scan.ts`
- Wire up crawler → detectors → terminal output
- Test: Full scan on test site

**Day 2: Severity Engine**
- `src/core/severity.ts`
- Scoring algorithm (page importance + type weight)
- Test: Verify scores make sense

**Day 3: Login Command**
- `src/commands/login.ts`
- Capture storage state
- Test: Auth flow on demo app

**Day 4: Auto-Bundle Generation**
- Generate test spec from Finding
- Create manifest.json
- Test: Scan → auto-generate bundles

**Day 5: Reporter + Polish**
- `src/core/report-generator.ts`
- Self-contained HTML template
- Test: Generate report, open in browser

**Weekend:** Dogfood — scan your own projects

---

## ✅ Phase 2: Determinism (Critical Path)

### Week 3-4: Validate Command

**Week 3, Day 1-2: Container Infrastructure**
- `src/core/container.ts`
- Dockerfile template generation
- Docker build + run
- Test: Run simple test in container

**Week 3, Day 3-4: HAR/MSW Integration**
- Implement chosen approach (HAR or MSW)
- Test: Record → replay → verify identical
- **Checkpoint:** Does it work? If no, pivot now.

**Week 3, Day 5: Determinism Algorithm**
- `src/core/determinism.ts`
- Run N times, parse results, calculate score
- Test: Known flaky vs stable tests

**Week 4, Day 1: Validate Command**
- `src/commands/validate.ts`
- CLI prompts → container → N runs → report
- Test: Full flow

**Week 4, Day 2: Redaction**
- `src/core/redactor.ts`
- **Use `redact-secrets` library**
- Test: Scrub HAR with real tokens

**Week 4, Day 3-4: Pack Command**
- `src/commands/pack.ts`
- Zip bundle, generate docs, GitHub Action
- Test: Unzip on fresh machine, run

**Week 4, Day 5: Record Command**
- `src/commands/record.ts` (from v1 plan)
- Manual recording session
- Test: Record a bug, validate it

**Weekend:** Integration testing — scan → validate → pack pipeline

---

## ✅ Phase 3: MCP + Diff (High Value)

### Week 5: MCP Server + Diff

**Day 1-2: MCP Server**
- `src/mcp/server.ts`
- `src/mcp/tools.ts`
- Register all 5 tools (scan, record, validate, pack, diff)
- Test: MCP Inspector

**Day 3: Diff Command**
- `src/commands/diff.ts`
- Fingerprinting, comparison logic
- Test: Compare two scan runs

**Day 4: Config File Support**
- `.reprorc.json` schema
- Config loader
- Wire into all commands
- Test: Override defaults via config

**Day 5: CLI Polish**
- `--help` docs for all commands
- Error handling
- Graceful Ctrl+C
- Test: UX walkthrough

**Weekend:** Demo preparation

---

## ✅ Phase 4: Polish + Ship

### Week 6: Testing + Launch

**Day 1-2: Automated Tests**
- Detector tests (Vitest)
- Severity scoring tests
- Determinism algorithm tests
- Redactor tests

**Day 3: Documentation**
- README.md (with GIFs)
- API docs
- Example bundles
- Troubleshooting guide

**Day 4: Demo Video**
- Record demo (10 min max)
- Edit, add captions
- Upload to YouTube

**Day 5: Launch Prep**
- npm publish dry-run
- GitHub repo polish (topics, description)
- Create announcement post (HN, Reddit)

**Weekend:** LAUNCH 🚀

---

## 🎯 Success Metrics

### Technical Validation
- [ ] HAR replay success rate > 70% (or MSW alternative validated)
- [ ] Determinism scores match manual verification
- [ ] All 7 detectors have < 10% false positive rate
- [ ] Docker builds work on macOS, Linux, Windows

### User Validation (Week 6+)
- [ ] 5+ GitHub stars in first week
- [ ] 3+ community issues/PRs filed
- [ ] 1+ "this actually worked" testimonial
- [ ] 50+ npm downloads in first month

### Portfolio Validation
- [ ] Demo video < 10 min, < 500 views
- [ ] README has clear architecture section
- [ ] At least 3 example bundles in repo
- [ ] Mentioned in resume with impact statement

---

## 🚫 Things NOT To Build (Yet)

### Defer to v1.1+
- Visual regression detection
- Delta debugging (`shrink` command)
- Multi-browser support (Firefox, WebKit)
- Plugin marketplace
- Cloud hosting/SaaS
- Advanced CI integrations beyond GitHub Actions
- Custom reporter formats (PDF, Slack, etc.)

### Why?
Ship fast. Get feedback. These are nice-to-haves that distract from core value prop.

---

## 🔄 Iteration Plan (Post-Launch)

### Week 7-8: Community Feedback
- Fix critical bugs from early users
- Add 1-2 most-requested features
- Write blog post about architecture decisions

### Week 9-10: Differentiation
- Add unique feature no competitor has
- Improve determinism scoring algorithm
- Optimize performance (scan speed, bundle size)

### Week 11-12: Growth
- Write guest posts (Hashnode, Dev.to)
- Submit to tool directories (Uneed, Product Hunt)
- Create Twitter thread about learnings

---

## 📊 Risk Register

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| HAR replay < 70% success | 🟡 Medium | 🔴 Critical | Prototype first, pivot to MSW |
| Web Vitals inaccurate | 🟡 Medium | 🟡 Medium | Use `web-vitals` library |
| Crawler too slow | 🟢 Low | 🟡 Medium | Add concurrency option |
| MCP SDK breaking changes | 🟡 Medium | 🟡 Medium | Lock version, monitor changelog |
| Docker build failures | 🟢 Low | 🔴 Critical | Test on 3 platforms early |
| False positive noise | 🔴 High | 🟡 Medium | Add ignore rules, tune severity |

---

## ✉️ Weekly Check-In Questions

**End of Each Week:**
1. What worked this week?
2. What didn't work?
3. What do I wish I knew before starting?
4. Is the schedule still realistic?
5. Should I cut scope or add time?

**Document answers in weekly notes.**

---

## 🎬 Final Pre-Flight Checklist

Before writing any production code:

- [ ] HAR replay prototype completed
- [ ] Decision made: HAR vs MSW vs manual mocking
- [ ] Week 0 validation results documented
- [ ] GitHub repo created with README
- [ ] Dev environment set up (Node 20+, Docker, Playwright browsers)
- [ ] Test sites identified (10+ URLs to dogfood against)
- [ ] Build schedule adjusted based on Week 0 findings
- [ ] Risk mitigation strategies documented
- [ ] .reprorc.json schema drafted

**If all checked:** 🟢 GO — Start Week 1

**If any unchecked:** ⚠️ HOLD — Finish validation first

---

## 📞 Decision Points

| Week | Decision | Criteria | Fallback |
|------|----------|----------|----------|
| 0 | HAR vs MSW | Success rate > 70% | MSW or manual mocking |
| 2 | Continue scan features vs simplify | All detectors working | Cut to 5 detectors |
| 3 | Docker vs local validation | Docker builds pass | Local-only mode |
| 4 | MCP server vs defer | Week 3-4 on track | Ship MCP in v1.1 |
| 5 | Launch vs polish | Core flow works end-to-end | Add Week 7 |

**Rule:** If any decision point goes to fallback, re-evaluate total scope.

---

**Next Action:** Run HAR replay prototype (test-har-replay.ts) 👆
