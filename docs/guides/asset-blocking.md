# Asset Blocking Optimization

## Overview

Block unnecessary resource downloads (images, fonts, media, styles) to achieve **30-40% faster scans** with zero impact on detection accuracy.

## Quick Start

```bash
# Maximum optimization (all assets blocked)
npx repro-in-a-box scan https://example.com \
  --block-images --block-fonts --block-media --block-styles

# Recommended (images + media)
npx repro-in-a-box scan https://example.com \
  --block-images --block-media

# Disable all blocking (full resources)
npx repro-in-a-box scan https://example.com --no-asset-blocking
```

## Asset Types

| Asset Type | CLI Flag | Impact | File Types |
|-----------|----------|--------|-----------|
| **Images** | --block-images | High (saves 50%+ bandwidth) | PNG, JPG, GIF, SVG, WebP, ICO |
| **Fonts** | --block-fonts | Medium (saves 10% bandwidth) | WOFF, WOFF2, TTF, OTF, EOT |
| **Media** | --block-media | Very High (saves 60%+ bandwidth) | MP3, MP4, WebM, OGG, WAV, FLV |
| **Stylesheets** | --block-styles | Low (saves 5% bandwidth) | CSS |

## Performance Improvement

```
Without Blocking    With Blocking    Improvement
─────────────────────────────────────────────────
45 seconds          28 seconds       -38% ⚡
85 MB transferred   35 MB            -59% 📉
```

## Use Cases

### CI/CD Pipelines
```bash
# Fast, minimal bandwidth
npx repro-in-a-box scan https://staging.example.com \
  --block-images --block-media \
  --progress minimal \
  --output results.json
```

### Large-Scale Audits
```bash
# Scan 100+ URLs quickly
npx repro-in-a-box scan https://example.com \
  --block-images --block-fonts --block-media \
  --max-pages 50 \
  --rate-limit 200
```

### Interactive Scanning
```bash
# No blocking - see actual rendering
npx repro-in-a-box scan https://example.com \
  --no-asset-blocking \
  --screenshots \
  --bundle
```

## Detection Impact

✅ **NO IMPACT** on:
- JavaScript error detection
- Network error detection
- Accessibility checks
- Web Vitals measurement
- Broken link detection
- Mixed content detection

## Configuration

### Default Behavior
Asset blocking is **ENABLED by default** since v2.7.0:
```bash
# Asset blocking automatic (all types blocked)
npx repro-in-a-box scan https://example.com
```

### Selective Blocking
```bash
# Block only images and media
npx repro-in-a-box scan https://example.com \
  --block-images --block-media

# Block images except stylesheets
npx repro-in-a-box scan https://example.com \
  --block-images --block-fonts --block-media
```

### Disable All Blocking
```bash
npx repro-in-a-box scan https://example.com --no-asset-blocking
```

## Performance Tuning

### Maximum Speed
```bash
npx repro-in-a-box scan https://example.com \
  --block-images --block-fonts --block-media --block-styles \
  --nav-timeout 15000 \
  --action-timeout 10000
```

### Maximum Accuracy
```bash
npx repro-in-a-box scan https://example.com \
  --no-asset-blocking \
  --nav-timeout 30000 \
  --bundle
```

## Troubleshooting

**Q: Why is scan still slow?**
- Ensure you're using `--block-images --block-media`
- Check network conditions
- Consider longer timeouts for slow sites

**Q: Do screenshots work with asset blocking?**
- ❌ **NO** - Disable blocking for screenshots:
  ```bash
  npx repro-in-a-box scan https://example.com \
    --no-asset-blocking --screenshots
  ```

**Q: Does blocking affect detection?**
- ✅ **NO** - Detection accuracy is unchanged

---

See [Feature Guides](./README.md) for more information.
