# Troubleshooting Guide

## Installation & Setup

### "Command not found: repro-in-a-box"

**Problem**: CLI tool not recognized after installation

**Solutions**:

1. **Global installation**:
   ```bash
   npm install -g repro-in-a-box
   repro-in-a-box scan https://example.com
   ```

2. **Via npx** (no installation):
   ```bash
   npx repro-in-a-box scan https://example.com
   ```

3. **Check installation**:
   ```bash
   npm list -g repro-in-a-box
   ```

4. **Fix PATH issues**:
   ```bash
   # Find npm global directory
   npm config get prefix
   
   # Add to PATH in ~/.bashrc or ~/.zshrc
   export PATH="$(npm config get prefix)/bin:$PATH"
   ```

### "Cannot find module 'repro-in-a-box'"

**Problem**: Import error in Node.js code

**Solutions**:

1. **Install as dependency**:
   ```bash
   npm install repro-in-a-box
   ```

2. **Check node_modules**:
   ```bash
   ls node_modules | grep repro
   ```

3. **Reinstall**:
   ```bash
   npm uninstall repro-in-a-box
   npm install repro-in-a-box
   ```

---

## Scanning Issues

### "Scan took too long"

**Problem**: Scan times out or exceeds expectation

**Solutions**:

1. **Check network**:
   ```bash
   # Reduce network latency
   npx repro-in-a-box scan https://example.com \
     --nav-timeout 20000 \
     --action-timeout 10000
   ```

2. **Enable asset blocking** (30-40% faster):
   ```bash
   npx repro-in-a-box scan https://example.com \
     --block-images --block-media
   ```

3. **Reduce page scope**:
   ```bash
   npx repro-in-a-box scan https://example.com \
     --max-pages 10
   ```

4. **Disable slow operations**:
   ```bash
   npx repro-in-a-box scan https://example.com \
     --no-bundle \
     --no-screenshots
   ```

### "Connection refused"

**Problem**: Cannot reach target website

**Solutions**:

1. **Check URL**:
   ```bash
   # Valid: https://example.com (https required)
   # Invalid: example.com, http://example.com (should be https)
   npx repro-in-a-box scan https://example.com
   ```

2. **Check network**:
   ```bash
   # Test connectivity
   curl -I https://example.com
   ping example.com
   ```

3. **Check firewall**:
   ```bash
   # If behind corporate firewall, may need proxy
   npx repro-in-a-box scan https://example.com \
     --headless=false  # Debug in browser
   ```

4. **For localhost**:
   ```bash
   # Ensure server is running
   npx repro-in-a-box scan http://localhost:3000  # Note: http allowed for localhost
   ```

### "JavaScript errors detected but site works fine"

**Problem**: False positives from JS errors

**Solutions**:

1. **Check error details**:
   ```bash
   npx repro-in-a-box scan https://example.com \
     --log debug  # See full error messages
   ```

2. **Ignore specific errors** (configure):
   - Edit `.squirrelscan/config.json`
   - Add patterns to `jsErrorIgnorePatterns`

3. **Check source maps**:
   - Errors in bundled/minified code are harder to debug
   - Using source maps improves accuracy

### "No issues found but site has problems"

**Problem**: Scan returned empty results

**Solutions**:

1. **Check detector configuration**:
   ```bash
   npx repro-in-a-box scan https://example.com \
     --log debug  # See which detectors ran
   ```

2. **Ensure full scanning**:
   ```bash
   npx repro-in-a-box scan https://example.com \
     --max-pages 0  # Unlimited pages (may be slow)
     --no-asset-blocking  # Don't skip resources
   ```

3. **Enable specific detectors**:
   ```bash
   # Via config or repeated --detector flags
   npx repro-in-a-box scan https://example.com \
     --detector accessibility \
     --detector performance
   ```

---

## Performance Issues

### "High memory usage"

**Problem**: Scanner uses excessive RAM

**Solutions**:

1. **Limit concurrent pages**:
   ```bash
   npx repro-in-a-box scan https://example.com \
     --max-pages 10 \
     --rate-limit 500  # 500ms between pages
   ```

2. **Enable asset blocking**:
   ```bash
   npx repro-in-a-box scan https://example.com \
     --block-images --block-media
   ```

3. **Disable bundle**:
   ```bash
   npx repro-in-a-box scan https://example.com --no-bundle
   ```

4. **Monitor memory**:
   ```bash
   # On macOS
   npx repro-in-a-box scan https://example.com | top -o MEM
   ```

### "Slow scan speed"

**Problem**: Scans are slower than expected

**Solutions**:

1. **Check asset blocking** (should be ~2x faster):
   ```bash
   # Time without blocking
   time npx repro-in-a-box scan https://example.com
   
   # Time with blocking (should be faster)
   time npx repro-in-a-box scan https://example.com \
     --block-images --block-media
   ```

2. **Reduce detection scope**:
   ```bash
   # Only run specific detectors
   npx repro-in-a-box scan https://example.com \
     --detector js-errors \
     --detector broken-links
   ```

3. **Check network**:
   - Scan may be network-bound, not CPU-bound
   - Try `--rate-limit 0` to allow maximum parallelism

---

## Output & Reporting Issues

### "Output file not created"

**Problem**: `--output` file not generated

**Solutions**:

1. **Check path permissions**:
   ```bash
   # Ensure write access to target directory
   ls -la results/  # Check if directory exists
   mkdir -p results  # Create if needed
   ```

2. **Use absolute path**:
   ```bash
   npx repro-in-a-box scan https://example.com \
     --output /absolute/path/results.json
   ```

3. **Check for errors**:
   ```bash
   npx repro-in-a-box scan https://example.com \
     --output results.json \
     --log debug 2>&1 | tail -20
   ```

### "HTML report missing styles"

**Problem**: Report renders without CSS

**Solutions**:

1. **Ensure bundle option**:
   ```bash
   npx repro-in-a-box scan https://example.com \
     --output report.html \
     --bundle
   ```

2. **Check file wasn't truncated**:
   ```bash
   # Verify file size is reasonable (>50KB)
   ls -lh report.html
   ```

### "Export format not recognized"

**Problem**: `--format` option not working

**Solutions**:

1. **Check valid formats**:
   ```bash
   npx repro-in-a-box scan --help
   # Look for --format options
   ```

2. **Use correct syntax**:
   ```bash
   # Correct
   npx repro-in-a-box scan https://example.com --format json
   
   # Incorrect
   npx repro-in-a-box scan https://example.com --format=json
   ```

---

## Logging & Debugging

### "Enable detailed logging"

```bash
npx repro-in-a-box scan https://example.com --log debug
```

**Log levels** (in order of verbosity):
1. `error` - Only errors
2. `warn` - Errors + warnings
3. `info` - Errors + warnings + info (default)
4. `debug` - Everything + diagnostic info

### "Disable progress output"

```bash
npx repro-in-a-box scan https://example.com --progress none
```

or redirect stderr:

```bash
npx repro-in-a-box scan https://example.com 2>/dev/null
```

### "See browser window during scan"

```bash
# Headless mode disabled
npx repro-in-a-box scan https://example.com --headless=false --slow-mo 500
```

---

## Configuration Issues

### "Config file not found"

**Problem**: `.squirrelscan/config.json` missing or ignored

**Solutions**:

1. **Create default config**:
   ```bash
   npx repro-in-a-box init
   ```

2. **Check file location**:
   ```bash
   # Config should be in project root
   ls -la .squirrelscan/config.json
   ```

3. **Validate JSON**:
   ```bash
   cat .squirrelscan/config.json | jq .
   ```

### "Config changes not applied"

**Problem**: Options in config ignored

**Solutions**:

1. **CLI overrides config**:
   ```bash
   # CLI option takes precedence
   npx repro-in-a-box scan https://example.com \
     --log debug  # Overrides config
   ```

2. **Reload config**:
   ```bash
   # Ensure config.json was saved
   cat .squirrelscan/config.json
   
   # Clear cache if present
   rm -rf .squirrelscan/cache
   ```

---

## Getting Help

### Report an Issue

1. **Collect diagnostics**:
   ```bash
   npx repro-in-a-box --version
   node --version
   npm --version
   ```

2. **Run with verbose logging**:
   ```bash
   npx repro-in-a-box scan https://example.com \
     --log debug \
     > debug.log 2>&1
   ```

3. **Share debug log** (check for sensitive data first)

### See All Options

```bash
npx repro-in-a-box scan --help
npx repro-in-a-box --help  # All commands
```

---

See [Feature Guides](./README.md) for more information.
