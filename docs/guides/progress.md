# Real-Time Progress Reporting

## Overview

Monitor scan progress with real-time feedback. Choose from **3 formats** tailored to different use cases: simple progress bars for CI/CD, detailed breakdowns for interactive use, and minimal output for log parsing.

## Quick Start

```bash
# Simple progress bar (default for terminals)
npx repro-in-a-box scan https://example.com --progress simple

# Detailed progress with statistics
npx repro-in-a-box scan https://example.com --progress detailed

# Minimal output (optimal for CI/CD logs)
npx repro-in-a-box scan https://example.com --progress minimal
```

## Progress Formats

### Simple (Default)

```
Scanning: [████████░░░░░░░░░░░░░░░░] 35% • 2.5/7.1s ETA
```

**Best for**: Terminal use, interactive scanning

**Output**:
- 25-character progress bar
- Percentage complete
- Elapsed/estimated time
- Real-time updates

### Detailed

```
─────────────────────────────────────────
DETAILED PROGRESS
─────────────────────────────────────────
Pages analyzed        │ 8/23 (35%)
Detectors run         │ 7/7 complete
Issues found          │ 12
  ├─ Accessibility    │ 3
  ├─ Performance      │ 5
  └─ Security         │ 4

Elapsed time         │ 2m45s
Estimated remaining  │ 5m20s
─────────────────────────────────────────
```

**Best for**: Interactive scanning, debugging, detailed logs

**Output**:
- Full progress breakdowns by detector
- Issue counts per category
- Timing information
- Page-by-page analysis

### Minimal

```
Progress: 35% (8/23 pages) [00:02:45 / 00:08:05 ETA]
```

**Best for**: CI/CD pipelines, log parsing, JSON output

**Output**:
- Single line format
- Compact statistics
- Machine-parseable
- No control characters

## CLI Options

```bash
# Explicitly set format
--progress <format>    # simple, detailed, or minimal
--progress-interval    # Update frequency (default: 1000ms)

# Disable progress reporting
--progress none       # No real-time updates
```

## Use Cases

### CI/CD Pipeline
```bash
npx repro-in-a-box scan https://staging.example.com \
  --progress minimal \
  --output results.json \
  --exit-code > scan.log 2>&1
```

### Interactive Debugging
```bash
npx repro-in-a-box scan https://example.com \
  --progress detailed \
  --headless=false \
  --log=debug
```

### Batch Scanning
```bash
for url in $(cat urls.txt); do
  echo "Scanning: $url"
  npx repro-in-a-box scan "$url" \
    --progress minimal \
    --output results/$url.json
done
```

## Progress Estimation

### ETA Calculation
Estimated time is based on:
1. Current scan speed (pages/second)
2. Remaining pages to scan
3. Historical detector performance

**Accuracy**: ±20% for typical scans

### Time Display Formats
- `1m45s` - Minutes and seconds
- `00:02:45` - HH:MM:SS (detailed format)

## Performance Monitoring

### Event Types

Progress reporter tracks:
- **scan_started** - Initial state
- **page_analyzed** - Page completed
- **detector_starting** - Detector running
- **detector_completed** - Detector finished
- **scan_completed** - Final results
- **scan_failed** - Error occurred

### Real-Time Updates

Default refresh rate: **1000ms** (1 second)

```bash
# Update every 500ms (more frequent)
npx repro-in-a-box scan https://example.com \
  --progress detailed \
  --progress-interval 500

# Update every 2000ms (less frequent)
npx repro-in-a-box scan https://example.com \
  --progress simple \
  --progress-interval 2000
```

## Integration Examples

### GitHub Actions
```yaml
- name: Scan website
  run: |
    npx repro-in-a-box scan https://example.com \
      --progress minimal \
      --output report.json
    
- name: Parse results
  run: jq '.issues | length' report.json
```

### Docker
```dockerfile
FROM node:20-alpine
RUN npm install -g repro-in-a-box

ENV REPORT_FORMAT=json
ENV PROGRESS_FORMAT=minimal

ENTRYPOINT ["npx", "repro-in-a-box", "scan"]
```

### Programmatic Usage
```typescript
import { Scanner, ProgressReporter } from 'repro-in-a-box';

const progress = new ProgressReporter({
  format: 'detailed',
  interval: 2000
});

progress.on('page_analyzed', (event) => {
  console.log(`Analyzed: ${event.url}`);
});

const scanner = new Scanner({
  progress
});

await scanner.scan(url);
```

## Troubleshooting

**Q: Progress doesn't update?**
- Ensure output is not redirected to a non-TTY
- Check `--progress minimal` for log files
- Verify `--progress-interval` is >500ms

**Q: How do I disable progress?**
- Use `--progress none`
- Or redirect stderr: `2>/dev/null`

**Q: Progress format not supported?**
- Use `--progress simple`, `--progress detailed`, or `--progress minimal`
- Default: `simple` for terminals, `minimal` for pipes

---

See [Feature Guides](./README.md) for more information.
