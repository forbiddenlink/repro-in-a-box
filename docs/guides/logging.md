# Structured Logging and Error Handling

## Overview

Repro-in-a-Box uses structured logging for better debugging, monitoring, and production observability. Configure log levels, enable verbose output, and handle errors gracefully.

## Quick Start

```bash
# Enable verbose logging
npx repro-in-a-box scan https://example.com --verbose

# Run with debug logging
DEBUG=* npx repro-in-a-box scan https://example.com
```

```typescript
import { logger, createChildLogger } from './utils/logger.js';

// Log at different levels
logger.info('Starting scan', { url });
logger.warn('Rate limited', { retryAfter: 60 });
logger.error('Timeout occurred', new Error('Max wait exceeded'));

// Create child logger with context
const scanLogger = createChildLogger({ scanId: '123', url });
scanLogger.info('Page completed');

// Time operations
const end = logger.time('Scan complete', { url });
// ... scanning ...
end(); // Logs elapsed time
```

## Log Levels

| Level | Usage | Example |
|-------|-------|---------|
| **DEBUG** | Detailed diagnostic info | `logger.debug('Detector setup complete')` |
| **INFO** | General information | `logger.info('Scanning page', { url })` |
| **WARN** | Recoverable issues | `logger.warn('Timeout approaching')` |
| **ERROR** | Critical issues | `logger.error('Scan failed', error)` |

## Error Types

```typescript
import { ValidationError, ConfigError, NetworkError, ScanError } from './utils/errors.js';

// Validation error (exit code 2)
throw new ValidationError('Invalid URL format');

// Configuration error (exit code 64)
throw new ConfigError('Missing required setting');

// Network error (exit code 69)
throw new NetworkError('Connection timeout');

// Scan error (exit code 1)
throw new ScanError('Detector crashed');
```

## Configuration

```typescript
const logger = new Logger({
  level: 'info',           // 'debug', 'info', 'warn', 'error'
  verbose: false,          // Show stack traces
  colors: true,            // Use ANSI colors
  includeTimestamp: true   // Show timestamps
});
```

## Usage Examples

### CLI Logging

```bash
# Verbose output with all logs
npx repro-in-a-box scan https://example.com --verbose

# Capture logs to file
npx repro-in-a-box scan https://example.com --verbose 2>&1 | tee scan.log
```

### Programmatic Integration

```typescript
import { Scanner } from 'repro-in-a-box/scanner';
import { createChildLogger } from 'repro-in-a-box/utils/logger';

const logger = createChildLogger({ command: 'scan', target: url });

try {
  const scanner = new Scanner(registry);
  logger.info('Starting scan', { url });
  const results = await scanner.scan({ url });
  logger.info('Scan complete', { issuesFound: results.summary.totalIssues });
} catch (error) {
  logger.error('Scan failed', error);
  throw error;
}
```

## Best Practices

✅ **DO:**
- Use structured context (key-value pairs)
- Log at appropriate levels
- Use child loggers for operations
- Time long-running operations

❌ **DON'T:**
- Log sensitive data (passwords, tokens)
- Use `console.log()` directly
- Silently catch and ignore errors
- Log the entire error object (use message)

## Troubleshooting

**Q: No logs appearing?**  
A: Check log level configuration and use `--verbose` flag

**Q: Too much output?**  
A: Reduce log level or use minimal progress mode

**Q: Logs not saved to file?**  
A: Redirect stderr: `2>&1 | tee logfile.txt`

---

See [Feature Guides](./README.md) for more information.
