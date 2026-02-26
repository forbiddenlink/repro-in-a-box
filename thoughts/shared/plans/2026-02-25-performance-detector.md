# Performance Detector Design

**Date:** 2026-02-25
**Status:** Approved
**Target Version:** v2.8.0

## Overview

Add a Performance Detector to repro-in-a-box that helps developers find why their site feels slow by detecting render-blocking resources and large assets.

## Architecture

```
PerformanceDetector extends BaseDetector
├── attach()     → Set up network request interception
├── scan()       → Analyze collected resources + check DOM for render-blocking
└── collect()    → Return accumulated issues
```

### Data Collection

1. **Network interception** (in `attach`): Use `page.on('response')` to capture all resource loads with sizes and types
2. **DOM analysis** (in `scan`): Check `<head>` for render-blocking `<script>` and `<link>` tags

### Resource Tracking

```typescript
interface ResourceInfo {
  url: string;
  type: 'script' | 'stylesheet' | 'image' | 'other';
  size: number;           // bytes (from Content-Length or body)
  mimeType: string;
}
```

## Detection Logic

### Thresholds

```typescript
const PERF_LIMITS = {
  JS_SIZE_WARNING: 250 * 1024,      // 250KB
  CSS_SIZE_WARNING: 100 * 1024,     // 100KB
  IMAGE_SIZE_WARNING: 500 * 1024,   // 500KB
  TOTAL_JS_WARNING: 1024 * 1024,    // 1MB total JS
};
```

### Render-Blocking Detection

```typescript
// Scripts in <head> without async/defer
const blockingScripts = await page.$$eval('head script[src]', scripts =>
  scripts.filter(s => !s.async && !s.defer).map(s => s.src)
);

// Stylesheets without media="print" or preload
const blockingStyles = await page.$$eval('link[rel="stylesheet"]', links =>
  links.filter(l => l.media !== 'print').map(l => l.href)
);
```

### Image Optimization

Flag large PNG/JPEG (>100KB) that could benefit from WebP/AVIF.

## Issue Types

| Type | Severity | Message Example |
|------|----------|-----------------|
| `perf-render-blocking-script` | Warning | "Render-blocking script: /bundle.js (no async/defer)" |
| `perf-render-blocking-css` | Info | "Render-blocking stylesheet: /styles.css" |
| `perf-large-js` | Warning | "Large JavaScript file: /app.js (312KB)" |
| `perf-large-css` | Warning | "Large CSS file: /theme.css (156KB)" |
| `perf-large-image` | Warning | "Large image: /hero.png (1.2MB)" |
| `perf-unoptimized-image` | Info | "Consider WebP/AVIF: /photo.jpg (245KB)" |

## Test Cases

1. Detects render-blocking script in head
2. Ignores script with `async` attribute
3. Ignores script with `defer` attribute
4. Detects render-blocking stylesheet
5. Ignores stylesheet with `media="print"`
6. Detects large JS file (>250KB)
7. Detects large CSS file (>100KB)
8. Detects large image (>500KB)
9. Suggests WebP for large JPEG
10. Suggests WebP for large PNG
11. No issues for optimized page
12. Handles pages with no resources gracefully

## Registration

Per project conventions, register in 3 places:

1. `src/cli/commands/scan.ts` - CLI command
2. `src/mcp/server.ts` - MCP server
3. `src/determinism/replayer.ts` - HAR replay validation

## Files

| File | Lines | Purpose |
|------|-------|---------|
| `src/detectors/performance.ts` | ~150 | Detector implementation |
| `tests/detectors/performance.test.ts` | ~200 | 12 unit tests |
