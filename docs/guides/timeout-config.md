# Timeout Configuration

## Overview

Prevent indefinite hangs and optimize scanning speed with configurable timeouts for navigation, actions, and detector operations.

## Quick Start

```bash
# Default timeouts (30 seconds each)
npx repro-in-a-box scan https://example.com

# Custom timeouts (faster, for slow networks)
npx repro-in-a-box scan https://example.com \
  --nav-timeout 20000 \
  --action-timeout 15000 \
  --detection-timeout 10000
```

## Timeout Types

### Navigation Timeout (--nav-timeout)
- **Applies to**: `page.goto()`, `waitForNavigation()`
- **Default**: 30,000 ms (30 seconds)
- **Use when**: Pages take a long time to load
- **Example**: 
  ```bash
  npx repro-in-a-box scan https://slow-server.com --nav-timeout 60000
  ```

### Action Timeout (--action-timeout)
- **Applies to**: clicks, typing, form fills
- **Default**: 30,000 ms (30 seconds)
- **Use when**: Interactive elements respond slowly
- **Example**:
  ```bash
  npx repro-in-a-box scan https://example.com --action-timeout 20000
  ```

### Detection Timeout (--detection-timeout)
- **Applies to**: detector operations
- **Default**: 30,000 ms (30 seconds)
- **Use when**: Detectors take longer to analyze  
- **Example**:
  ```bash
  npx repro-in-a-box scan https://example.com --detection-timeout 15000
  ```

## Configuration Presets

### Fast Scan (Slow Networks)
```bash
npx repro-in-a-box scan https://example.com \
  --nav-timeout 20000 \
  --action-timeout 15000 \
  --detection-timeout 10000
```
**When to use**: 3G/4G, high latency, or time-constrained

### Standard (Default)
```bash
npx repro-in-a-box scan https://example.com
```
**When to use**: Normal network conditions, typical websites

### Patient (Slow Servers)
```bash
npx repro-in-a-box scan https://example.com \
  --nav-timeout 60000 \
  --action-timeout 45000 \
  --detection-timeout 30000
```
**When to use**: Known slow servers, complex pages

## Best Practices

✅ **DO:**
- Start with defaults, adjust if needed
- Increase timeouts for slow networks
- Decrease for fast networks (save time)
- Monitor actual times in logs

❌ **DON'T:**
- Set too low (will fail on slow pages)
- Set too high (wastes time waiting)
- Use same timeout for all types
- Ignore timeout errors in logs

## Troubleshooting

**Q: Getting timeout errors?**
```bash
# Increase the appropriate timeout
npx repro-in-a-box scan https://example.com --nav-timeout 45000
```

**Q: Scans too slow?**
```bash
# Decrease timeouts for fast networks
npx repro-in-a-box scan https://example.com --nav-timeout 15000
```

**Q: Which timeout is failing?**
```bash
# Use verbose logging
npx repro-in-a-box scan https://example.com --verbose
```

## Performance Impact

| Timeout | Too Low | Too High |
|---------|---------|----------|
| Navigation | Fails on slow pages | Wastes time |
| Action | Fails on slow interactions | Wastes time |
| Detection | Fails on complex pages | Very slow scans |

---

See [Feature Guides](./README.md) for more information.
