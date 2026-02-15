# Repro-in-a-Box v2: Build Checklist

**Purpose:** Ready-to-execute checklist for building Repro-in-a-Box v2  
**Status:** ⚠️ Start with Week 0 validation before proceeding

---

## 🚨 CRITICAL: Week 0 Validation (BLOCKING)

**Duration:** 2 days  
**Goal:** Validate HAR replay viability before committing to implementation

### Checklist

- [ ] Create `repro-in-a-box` directory
- [ ] Initialize npm project: `npm init -y`
- [ ] Install Playwright: `npm install playwright@1.50.0 tsx`
- [ ] Copy `test-har-replay.ts` from [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md#day-1-har-replay-prototype)
- [ ] Run validation: `npx tsx test-har-replay.ts`
- [ ] Wait for results (10-30 minutes depending on network)
- [ ] Review `har-validation-results.json`
- [ ] **DECISION POINT:**
  - [ ] ≥70% success → Proceed with HAR replay
  - [ ] 50-70% success → Research hybrid approach
  - [ ] <50% success → Switch to MSW, update docs

**🛑 DO NOT PROCEED TO WEEK 1 UNTIL THIS IS COMPLETE**

---

## Week 1: Project Setup & Simple Detectors

**Goal:** Functional detector framework with 3 basic detectors

### Day 1: Project Initialization

- [ ] **Repository Setup**
  - [ ] Create GitHub repo: `repro-in-a-box`
  - [ ] Clone locally
  - [ ] Add `.gitignore` (Node.js template)
  - [ ] Create `README.md` with project description

- [ ] **Dependencies**
  ```bash
  npm install \
    playwright@1.50.0 \
    @modelcontextprotocol/sdk@^1.0.0 \
    web-vitals@^5.1.0 \
    @axe-core/playwright@^4.11.1 \
    commander@^12.0.0 \
    inquirer@^9.2.0 \
    zod@^3.22.0

  npm install -D \
    @types/node@^20.11.0 \
    @types/inquirer@^9.0.0 \
    typescript@^5.3.0 \
    tsx@^4.7.0 \
    vitest@^1.2.0 \
    @playwright/test@1.50.0
  ```

- [ ] **TypeScript Configuration**
  - [ ] Copy `tsconfig.json` from [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md#day-1-project-initialization)
  - [ ] Update `package.json` with build scripts
  - [ ] Set `"type": "module"` in `package.json`
  - [ ] Test build: `npm run build`

### Day 2: Detector Framework

- [ ] **Create Directory Structure**
  ```bash
  mkdir -p src/{detectors,cli,crawler,bundler,mcp}
  ```

- [ ] **Base Detector Interface**
  - [ ] Create `src/detectors/base.ts`
  - [ ] Copy interface from [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md#day-2-detector-framework)

- [ ] **Detector Registry**
  - [ ] Create `src/detectors/registry.ts`
  - [ ] Implement `register()`, `get()`, `getAll()`, `list()` methods
  - [ ] Test basic registration

### Day 3: JavaScript Error Detector

- [ ] **Implementation**
  - [ ] Create `src/detectors/js-errors.ts`
  - [ ] Copy implementation from [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md#day-3-javascript-error-detector)
  - [ ] Add tests: `src/detectors/__tests__/js-errors.test.ts`

- [ ] **Manual Testing**
  ```typescript
  // Create test-js-errors.ts
  const detector = new JavaScriptErrorDetector();
  const page = await browser.newPage();
  await detector.setup(page);
  await detector.navigate(page, 'https://example.com');
  const result = await detector.collect(page);
  console.log(result);
  ```

### Day 4: Network Error Detector

- [ ] **Implementation**
  - [ ] Create `src/detectors/network-errors.ts`
  - [ ] Copy implementation from [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md#day-4-network-error-detector)
  - [ ] Add tests: `src/detectors/__tests__/network-errors.test.ts`

- [ ] **Integration Test**
  - [ ] Test against site with known broken requests
  - [ ] Verify 404s are captured
  - [ ] Verify 500s are captured

### Day 5: Broken Assets Detector

- [ ] **Implementation**
  - [ ] Create `src/detectors/broken-assets.ts`
  - [ ] Copy implementation from [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md#day-5-broken-assets-detector)
  - [ ] Add tests: `src/detectors/__tests__/broken-assets.test.ts`

- [ ] **Commit & Push**
  - [ ] Commit all Week 1 work
  - [ ] Tag as `v2.0.0-alpha.1`
  - [ ] Push to GitHub

---

## Week 2: Scan Command & Auto-Bundle

**Goal:** Working CLI that scans a URL and saves results

### Day 1: CLI Framework

- [ ] **Commander Setup**
  - [ ] Create `src/cli/index.ts`
  - [ ] Copy CLI skeleton from [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md#day-1-cli-framework)
  - [ ] Add shebang: `#!/usr/bin/env node`
  - [ ] Make executable: `chmod +x src/cli/index.ts`

- [ ] **Scan Command**
  - [ ] Create `src/cli/commands/scan.ts`
  - [ ] Copy implementation from [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md#day-1-cli-framework)
  - [ ] Register detectors in command

- [ ] **Test CLI**
  ```bash
  npm run build
  node dist/cli/index.js scan https://example.com
  ```

### Day 2-3: Crawler Implementation

- [ ] **Core Crawler**
  - [ ] Create `src/crawler/crawler.ts`
  - [ ] Copy implementation from [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md#day-2-3-crawler-implementation)
  - [ ] Add URL normalization
  - [ ] Add depth limiting
  - [ ] Add rate limiting

- [ ] **Link Extraction**
  - [ ] Implement `extractLinks()` method
  - [ ] Filter by base URL
  - [ ] Deduplicate links

- [ ] **Integration with Scan Command**
  - [ ] Update `scan.ts` to use `Crawler`
  - [ ] Add crawler options to CLI flags
  - [ ] Test multi-page crawl: `repro scan https://example.com --max-pages 5`

### Day 4-5: Auto-Bundle Feature

- [ ] **Bundler Implementation**
  - [ ] Install `adm-zip`: `npm install adm-zip @types/adm-zip`
  - [ ] Create `src/bundler/bundler.ts`
  - [ ] Copy implementation from [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md#day-4-5-auto-bundle-feature)

- [ ] **Generate Reproduction Script**
  - [ ] Create `reproduce.sh` template
  - [ ] Include scan results in bundle
  - [ ] Include HAR file (if available)

- [ ] **Test Bundling**
  ```bash
  repro scan https://example.com --max-pages 3
  # Should create repro-package.zip
  unzip -l repro-package.zip
  # Should contain: scan-results.json, reproduce.sh
  ```

- [ ] **Commit & Push**
  - [ ] Commit Week 2 work
  - [ ] Tag as `v2.0.0-alpha.2`

---

## Week 3-4: Determinism Validation

**Goal:** HAR recording/replay working end-to-end

### Week 3, Day 1-2: HAR Recording

- [ ] **Recorder Implementation**
  - [ ] Create `src/determinism/har-recorder.ts`
  - [ ] Copy implementation from [TECHNICAL_SPEC.md § 4](./TECHNICAL_SPEC.md#4-har-replay-system)
  - [ ] Add to scan command: `--record-har` flag

- [ ] **Test Recording**
  ```bash
  repro scan https://example.com --record-har
  # Should create recording.har
  ```

### Week 3, Day 3-5: HAR Replay

- [ ] **Replayer Implementation**
  - [ ] Create `src/determinism/har-replayer.ts`
  - [ ] Copy implementation from [TECHNICAL_SPEC.md § 4](./TECHNICAL_SPEC.md#4-har-replay-system)
  - [ ] Handle `notFound: 'fallback'` option

- [ ] **Validate Command**
  - [ ] Create `src/cli/commands/validate.ts`
  - [ ] Implement `--runs` option (default: 3)
  - [ ] Compare results across runs
  - [ ] Calculate determinism score

- [ ] **Test Replay**
  ```bash
  repro validate ./repro-output --runs 3
  # Should replay HAR 3x and compare results
  ```

### Week 4: Determinism Testing

- [ ] **E2E Tests**
  - [ ] Create `tests/e2e/har-replay.spec.ts`
  - [ ] Test against 5 different sites
  - [ ] Verify ≥70% success rate

- [ ] **Error Handling**
  - [ ] Handle missing HAR files gracefully
  - [ ] Handle replay failures
  - [ ] Provide clear error messages

- [ ] **Commit & Push**
  - [ ] Commit Week 3-4 work
  - [ ] Tag as `v2.0.0-beta.1`

---

## Week 5: MCP Server & Diff

**Goal:** MCP integration + diff command working

### Day 1-2: MCP Server (stdio transport)

- [ ] **Server Implementation**
  - [ ] Create `src/mcp/server.ts`
  - [ ] Copy implementation from [TECHNICAL_SPEC.md § 3](./TECHNICAL_SPEC.md#3-mcp-server-architecture)
  - [ ] Implement `scan_site` tool
  - [ ] Implement `validate_reproduction` tool
  - [ ] Implement `diff_scans` tool

- [ ] **Entry Point**
  - [ ] Create `src/mcp/index.ts`
  - [ ] Add `mcp` script to `package.json`: `"mcp": "node dist/mcp/index.js"`

- [ ] **Test MCP Server**
  ```bash
  npm run build
  echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | npm run mcp
  # Should return list of 3 tools
  ```

### Day 3: Claude Desktop Integration

- [ ] **Configuration**
  - [ ] Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:
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

- [ ] **Test in Claude**
  - [ ] Restart Claude Desktop
  - [ ] Ask: "What tools do you have?"
  - [ ] Verify `scan_site`, `validate_reproduction`, `diff_scans` appear
  - [ ] Test: "Scan https://example.com for bugs"

### Day 4-5: Diff Command

- [ ] **Diff Implementation**
  - [ ] Create `src/cli/commands/diff.ts`
  - [ ] Copy implementation from [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md#diff-command)
  - [ ] Implement issue comparison logic

- [ ] **Test Diff**
  ```bash
  repro scan https://example.com -o scan-a
  # Make changes to site
  repro scan https://example.com -o scan-b
  repro diff scan-a scan-b
  # Should show new/fixed issues
  ```

- [ ] **Commit & Push**
  - [ ] Commit Week 5 work
  - [ ] Tag as `v2.0.0-beta.2`

---

## Week 6: Testing & Polish

**Goal:** Production-ready with tests and documentation

### Day 1-2: Unit Tests

- [ ] **Test Setup**
  - [ ] Configure Vitest: `vitest.config.ts`
  - [ ] Create `src/detectors/__tests__/` directory

- [ ] **Write Tests**
  - [ ] Test all 7 detectors
  - [ ] Test crawler logic
  - [ ] Test bundler
  - [ ] Aim for >80% coverage

- [ ] **Run Tests**
  ```bash
  npm test
  npm run test:ui  # Visual test runner
  ```

### Day 3: Integration Tests

- [ ] **E2E Test Suite**
  - [ ] Create `tests/integration/` directory
  - [ ] Test full scan workflow
  - [ ] Test validate workflow
  - [ ] Test diff workflow

- [ ] **CI Setup** (Optional)
  - [ ] Add GitHub Actions workflow
  - [ ] Run tests on PR
  - [ ] Run tests on push to main

### Day 4: Documentation

- [ ] **README.md**
  - [ ] Copy template from [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md#documentation)
  - [ ] Add installation instructions
  - [ ] Add usage examples
  - [ ] Add detector descriptions

- [ ] **API Documentation**
  - [ ] Document MCP tools
  - [ ] Document CLI commands
  - [ ] Document detector interface

- [ ] **Example Outputs**
  - [ ] Screenshot of scan results
  - [ ] Example `scan-results.json`
  - [ ] Example `reproduce.sh`

### Day 5: Polish & Publish

- [ ] **Final Checks**
  - [ ] Run full test suite
  - [ ] Test CLI on 5 different sites
  - [ ] Verify MCP integration works
  - [ ] Check bundle contents

- [ ] **Publishing**
  - [ ] Set version to `2.0.0` in `package.json`
  - [ ] Commit: "Release v2.0.0"
  - [ ] Tag: `git tag v2.0.0`
  - [ ] Push: `git push origin main --tags`
  - [ ] Publish to npm: `npm publish`

- [ ] **Announcement**
  - [ ] Create demo video (Loom/YouTube)
  - [ ] Write Twitter/X thread
  - [ ] Share on Hacker News
  - [ ] Update portfolio

---

## Additional Detectors (Week 7+)

After launch, add remaining detectors:

### Accessibility Detector

- [ ] Create `src/detectors/accessibility.ts`
- [ ] Copy implementation from [TECHNICAL_SPEC.md § 5](./TECHNICAL_SPEC.md#5-accessibility-testing)
- [ ] Test against WCAG test pages

### Web Vitals Detector

- [ ] Create `src/detectors/web-vitals.ts`
- [ ] Copy implementation from [TECHNICAL_SPEC.md § 2](./TECHNICAL_SPEC.md#2-web-vitals-implementation)
- [ ] Use official `web-vitals` library
- [ ] Test LCP/INP/CLS measurement

### Mixed Content Detector

- [ ] Create `src/detectors/mixed-content.ts`
- [ ] Detect HTTP resources on HTTPS pages
- [ ] Test on mixed-content test pages

### Broken Links Detector

- [ ] Create `src/detectors/broken-links.ts`
- [ ] Crawl and test all links
- [ ] Report 404s and timeouts

---

## Troubleshooting

### HAR Replay Fails

**Symptom:** `validate` command shows <70% success rate

**Solution:**
1. Check `har-validation-results.json` for patterns
2. If WebSocket failures: Document as known limitation
3. If POST failures: Implement MSW fallback
4. If widespread: Switch to MSW entirely

### MCP Server Not Appearing in Claude

**Symptom:** Tools don't show up in Claude Desktop

**Solution:**
1. Check config path: `~/Library/Application Support/Claude/claude_desktop_config.json`
2. Verify absolute path to `dist/mcp/index.js`
3. Restart Claude Desktop completely
4. Check logs: `tail -f ~/Library/Logs/Claude/mcp*.log`

### Detector Not Finding Issues

**Symptom:** Known issues not detected

**Solution:**
1. Test detector in isolation: `node dist/detectors/__tests__/detector.test.js`
2. Check `page.on()` event handlers are registered
3. Verify navigation completes: use `waitUntil: 'networkidle'`
4. Add debugging: `console.log()` in detector methods

---

## Success Criteria

- [ ] ✅ HAR replay validation ≥70% success
- [ ] ✅ All 7 detectors working
- [ ] ✅ CLI scan/validate/diff commands functional
- [ ] ✅ MCP server integrated with Claude
- [ ] ✅ Auto-bundling creates valid reproduction packages
- [ ] ✅ Tests passing (>80% coverage)
- [ ] ✅ Documentation complete
- [ ] ✅ Published to npm

**When all boxes are checked, you're ready to launch! 🚀**
