# Repro-in-a-Box Roadmap

**Current Version:** v2.5.0 🚀  
**Status:** Production-ready, 112+ tests, ~85% coverage  
**Published:** February 15, 2026

---

## ✅ Completed (v1.0 - v2.5.0)

### Core Features
- ✅ 7 built-in detectors (JS errors, network, assets, a11y, web vitals, mixed content, broken links)
- ✅ Multi-page crawler with rate limiting
- ✅ Auto-bundling (ZIP with HAR + screenshots)
- ✅ HAR replay validation (3x reproducibility testing)
- ✅ Diff comparison utility
- ✅ MCP server for Claude Desktop integration
- ✅ CLI commands (scan, validate, diff)
- ✅ Comprehensive test suite (112+ tests)
- ✅ Performance benchmarks

---

## 🎯 v2.6: Developer Experience (Est. 1-2 weeks)

**Goal:** Make it easier to configure, customize, and integrate

### Configuration System
- [ ] **Config File Support** (`.reprorc.json`, `.reprorc.js`)
  ```json
  {
    "detectors": ["js-errors", "accessibility", "web-vitals"],
    "crawler": { "maxDepth": 3, "maxPages": 50 },
    "output": { "format": "json", "path": "./reports" },
    "thresholds": { "minReproducibility": 70 }
  }
  ```
- [ ] **Environment Variables** (`REPRO_MAX_DEPTH`, `REPRO_DETECTORS`, etc.)
- [ ] **Config Validation** with Zod schemas

### CLI Enhancements
- [ ] **Interactive Setup:** `repro init` (prompts for settings)
- [ ] **Global Install:** `npm install -g repro-in-a-box`
- [ ] **Output Formats:** `--format json|csv|html|github-actions`
- [ ] **Watch Mode:** `repro scan --watch` (re-scan on file changes)
- [ ] **Quiet/Verbose Flags:** `--quiet`, `--verbose`, `--debug`
- [ ] **Progress Indicators:** Spinners, progress bars, ETA

### Error Handling
- [ ] Better error messages with suggestions
- [ ] Graceful degradation (continue on detector failures)
- [ ] Retry logic for network failures
- [ ] Detailed debug logs (`--debug` flag)

**Tests:** 25+ new tests  
**Deliverable:** v2.6.0 with enhanced DX

---

## 🔍 v2.7: New Detectors (Est. 1 week)

**Goal:** Expand detection capabilities to 12+ detectors

### SEO Detector
- [ ] Meta tags (title, description lengths)
- [ ] Open Graph tags (og:title, og:image, etc.)
- [ ] Twitter Card tags
- [ ] Structured data (JSON-LD, microdata)
- [ ] Canonical URLs
- [ ] XML sitemap validation
- [ ] Robots.txt parsing

### Performance Detector
- [ ] Bundle size analysis (JS, CSS, images)
- [ ] Render-blocking resources
- [ ] Unused CSS/JS detection
- [ ] Image optimization suggestions
- [ ] Font loading strategies
- [ ] Third-party script analysis

### Security Detector
- [ ] Content Security Policy (CSP) violations
- [ ] HTTPS enforcement
- [ ] Mixed content warnings (beyond current basic check)
- [ ] Secure cookie flags
- [ ] X-Frame-Options, X-Content-Type-Options
- [ ] Subresource Integrity (SRI) validation

### Console Warnings Detector
- [ ] Separate from error detector
- [ ] Categorize by severity
- [ ] Common framework warnings (React, Vue, Angular)
- [ ] Deprecation warnings

### Memory Leak Detector
- [ ] Track memory usage over time
- [ ] Detect growing memory patterns
- [ ] Event listener leaks
- [ ] DOM node leaks

**Tests:** 40+ new tests (8 tests per detector)  
**Deliverable:** v2.7.0 with 12 total detectors

---

## 📊 v2.8: Reporting & Visualization (Est. 2 weeks)

**Goal:** Beautiful, actionable reports

### HTML Reports
- [ ] Single-page HTML report generator
- [ ] Charts & graphs (Chart.js or D3.js)
- [ ] Issue severity visualization
- [ ] Timeline of detections
- [ ] Screenshot gallery
- [ ] Filterable issue table
- [ ] Shareable report links

### Dashboard
- [ ] Web-based dashboard (React/Next.js)
- [ ] Real-time scan monitoring
- [ ] Historical scan comparison
- [ ] Issue trending over time
- [ ] Team collaboration features
- [ ] Export to PDF/PNG

### GitHub Integration
- [ ] GitHub Actions workflow
- [ ] Pull request comments with scan results
- [ ] Status checks (pass/fail based on thresholds)
- [ ] Issue creation for new bugs
- [ ] Markdown report format

**Tests:** 20+ new tests  
**Deliverable:** v2.8.0 with visual reporting

---

## 🔌 v2.9: Plugin System (Est. 2 weeks)

**Goal:** Allow users to create custom detectors

### Plugin API
- [ ] **Custom Detector Interface**
  ```typescript
  export class MyCustomDetector implements Detector {
    async setup(page: Page) { /* ... */ }
    async collect(page: Page) { /* ... */ }
  }
  ```
- [ ] **Plugin Discovery:** Load from `node_modules/repro-plugin-*`
- [ ] **Plugin Registry:** NPM packages with `repro-plugin` keyword
- [ ] **Plugin Validation:** Schema validation for plugin manifests
- [ ] **Plugin Lifecycle Hooks:** `beforeScan`, `afterScan`, `onError`

### Community Plugins
- [ ] Plugin template repository
- [ ] Plugin development guide
- [ ] Example plugins (WordPress, Shopify, React)
- [ ] Plugin marketplace/registry

**Tests:** 30+ new tests  
**Deliverable:** v2.9.0 with plugin system

---

## 🚀 v3.0: Advanced Features (Est. 3-4 weeks)

**Goal:** Enterprise-ready autonomous QA

### Scheduled Scanning
- [ ] Cron-like scheduling (`0 */6 * * *`)
- [ ] Background execution (daemon mode)
- [ ] SQLite database for scan history
- [ ] Scan queue management
- [ ] Parallel scan execution

### Historical Tracking
- [ ] Store all scans in database
- [ ] Trend analysis (issues over time)
- [ ] Regression detection (new issues vs. fixed)
- [ ] Baseline comparison
- [ ] Custom time ranges

### Notifications
- [ ] Webhook support (POST to URL on scan complete)
- [ ] Slack integration (incoming webhooks)
- [ ] Discord integration (webhooks)
- [ ] Email notifications (SMTP/SendGrid)
- [ ] Custom notification templates

### CI/CD Integration
- [ ] **GitHub Actions:** First-class action package
- [ ] **GitLab CI:** Example `.gitlab-ci.yml`
- [ ] **Jenkins:** Jenkinsfile template
- [ ] **CircleCI:** Config example
- [ ] Exit codes based on thresholds (fail CI if issues found)

### API Mode
- [ ] REST API server (Express/Fastify)
- [ ] GraphQL API option
- [ ] Authentication (API keys, JWT)
- [ ] Rate limiting
- [ ] OpenAPI/Swagger documentation

**Tests:** 50+ new tests  
**Deliverable:** v3.0.0 enterprise-ready

---

## 🎨 v3.1: Browser Extension (Est. 2 weeks)

**Goal:** One-click scanning from browser

### Extension Features
- [ ] Chrome/Firefox extension
- [ ] Right-click context menu: "Scan with Repro"
- [ ] Popup with quick scan results
- [ ] Badge with issue count
- [ ] Options page for configuration
- [ ] Sync with cloud dashboard (optional)

**Distribution:** Chrome Web Store, Firefox Add-ons  
**Deliverable:** v3.1.0 with browser extension

---

## 🔮 Future Ideas (v3.2+)

### AI/LLM Integration
- Auto-generate bug descriptions using Claude/GPT
- Suggest fixes for common issues
- Prioritize issues by business impact
- Natural language queries ("Show accessibility issues")

### Mobile Testing
- React Native support
- iOS/Android testing via Appium
- Mobile-specific detectors (touch targets, viewport)

### Visual Testing
- Screenshot comparison (pixel-by-pixel)
- Visual regression detection
- Component isolation testing

### Performance Profiling
- CPU profiling
- Network waterfall analysis
- Long task detection
- Frame rate monitoring

### Team Features
- Multi-user support
- Role-based access control
- Shared dashboards
- Commenting on issues
- Issue assignment workflow

---

## 🎯 Immediate Next Steps (This Week)

1. **Test Published Package** ✅
   ```bash
   npx repro-in-a-box@2.5.0 scan https://example.com
   ```

2. **Update Documentation** ✅
   - [x] Update README roadmap
   - [ ] Create CHANGELOG.md for v2.5.0
   - [ ] Add CONTRIBUTING.md
   - [ ] Record demo video/GIF

3. **Community Launch**
   - [ ] Post to Reddit (r/webdev, r/node, r/javascript)
   - [ ] Share on Twitter/X
   - [ ] Submit to Hacker News
   - [ ] Post on dev.to
   - [ ] Create Product Hunt page

4. **Real-World Validation**
   - [ ] Scan 10+ popular websites
   - [ ] Document findings
   - [ ] Create case studies
   - [ ] Fix any bugs discovered

---

## 📈 Success Metrics

**v2.5.0 Baseline:**
- 112+ tests
- ~85% coverage
- 7 detectors
- 133 published files
- 224.6 KB package size

**v3.0 Goals:**
- 300+ tests
- 90%+ coverage
- 15+ detectors
- 1000+ npm weekly downloads
- 100+ GitHub stars
- 10+ community plugins

---

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

**Priority Features:**
1. Config file support (v2.6)
2. HTML reports (v2.8)
3. SEO detector (v2.7)
4. Plugin system (v2.9)

Want to contribute? Pick a feature from the roadmap and open an issue!
