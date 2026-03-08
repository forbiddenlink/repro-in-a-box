/**
 * Error boundary pattern for repro-in-a-box
 * Distinguishes between expected application errors and unexpected runtime errors
 * 
 * Usage:
 *   throw new AppError('Scan failed', 'SCAN_ERROR', 1, { url: 'https://example.com' });
 *   throw new ValidationError('Invalid config', { field: 'maxPages', value: 2000 });
 */

/**
 * Base application error - for expected, recoverable errors
 * Exit codes follow Unix conventions:
 * - 1: General error
 * - 2: Misuse of shell command
 * - 64: Data format error
 * - 69: Service unavailable
 * - 127: Command not found
 */
export class AppError extends Error {
  public readonly isOperational = true; // Marks this as an expected operational error

  /**
   * @param message - User-friendly error message
   * @param code - Machine-readable error code
   * @param exitCode - Process exit code (default: 1)
   * @param context - Additional error context for logging
   */
  constructor(
    message: string,
    readonly code: string,
    readonly exitCode: number = 1,
    readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }

  /**
   * Create AppError from generic Error
   */
  static from(error: Error, code: string, context?: Record<string, unknown>): AppError {
    return new AppError(error.message, code, 1, context);
  }

  /**
   * Check if error is app error
   */
  static isAppError(err: unknown): err is AppError {
    return err instanceof AppError;
  }
}

/**
 * Options for creating AppError
 */
export interface AppErrorOptions {
  code: string;
  exitCode?: number;
  context?: Record<string, unknown>;
}

/**
 * Validation error - for config/parameter validation failures
 * Exit code: 2 (misuse of shell)
 */
export class ValidationError extends AppError {
  constructor(
    message: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'VALIDATION_ERROR', 2, context);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Configuration error - for config file loading/parsing failures
 * Exit code: 64 (data format error)
 */
export class ConfigError extends AppError {
  constructor(
    message: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'CONFIG_ERROR', 64, context);
    this.name = 'ConfigError';
    Object.setPrototypeOf(this, ConfigError.prototype);
  }
}

/**
 * Not found error - for missing files/resources
 * Exit code: 127 (command not found)
 */
export class NotFoundError extends AppError {
  constructor(
    message: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'NOT_FOUND', 127, context);
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Network error - for network/connectivity failures
 * Exit code: 69 (service unavailable)
 */
export class NetworkError extends AppError {
  constructor(
    message: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'NETWORK_ERROR', 69, context);
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

/**
 * Scan error - for scanning/detection failures
 * Exit code: 1 (general error)
 */
export class ScanError extends AppError {
  constructor(
    message: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'SCAN_ERROR', 1, context);
    this.name = 'ScanError';
    Object.setPrototypeOf(this, ScanError.prototype);
  }
}

/**
 * Error handler utility for CLI commands
 * Transforms errors into user-friendly output with appropriate exit codes
 */
export function handleError(error: unknown, context?: Record<string, unknown>): never {
  // Known application error - output friendly message
  if (error instanceof AppError) {
    console.error(`❌ [${error.code}] ${error.message}`);
    if (context?.verbose || process.env.DEBUG) {
      if (error.context) {
        console.error('Context:', error.context);
      }
      console.error(error.stack);
    }
    process.exit(error.exitCode);
  }

  // Unknown runtime error - provide more details
  if (error instanceof Error) {
    console.error('❌ Unexpected error:', error.message);
    if (process.env.DEBUG) {
      console.error(error.stack);
    } else {
      console.error('(Run with DEBUG=1 or --verbose for full stack trace)');
    }
    process.exit(1);
  }

  // Completely unknown
  console.error('❌ Unknown error:', String(error));
  process.exit(1);
}

/**
 * Wrap an async function to catch and handle errors
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withErrorHandler<Args extends unknown[], R>(
  fn: (...args: Args) => Promise<R>,
  verbose?: boolean
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
): (...args: Args) => Promise<R | never> {
  return async (...args: Args) => {
    try {
      return await fn(...args);
    } catch (error) {
      // Will never return due to process.exit in handleError
      return handleError(error, { verbose });
    }
  };
}

/**
 * Validate a condition, throw ValidationError if false
 */
export function assert(condition: boolean, message: string, context?: Record<string, unknown>): asserts condition {
  if (!condition) {
    throw new ValidationError(message, context);
  }
}

/**
 * Type guard for error with code property
 */
export function hasErrorCode(error: unknown): error is { code: string; message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    typeof (error as { code: unknown }).code === 'string'
  );
}

/**
 * Type guard to check if an error is operational (expected and recoverable)
 */
export function isOperationalError(error: unknown): error is AppError {
  return error instanceof Error && 'isOperational' in error && error.isOperational === true;
}

/**
 * Global error handlers for uncaught errors.
 * Should be registered once at application startup.
 * Prevents unhandled rejections and uncaught exceptions from crashing silently.
 */
export function registerGlobalErrorHandlers(logger?: { error: (msg: string, meta?: unknown) => void }): void {
  const log = logger?.error || ((msg: string, meta?: unknown) => {
    console.error(msg);
    if (meta) console.error(meta);
  });

  process.on('uncaughtException', (error: Error) => {
    log('FATAL: Uncaught Exception', {
      error: error.message,
      stack: error.stack,
      isOperational: isOperationalError(error)
    });
    
    // Give time to flush logs, then exit
    setTimeout(() => {
      process.exit(1);
    }, 1000).unref();
  });

  process.on('unhandledRejection', (reason: unknown) => {
    log('FATAL: Unhandled Promise Rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      isOperational: isOperationalError(reason)
    });
    
    // Convert unhandled rejections to exceptions
    throw reason;
  });

  // Clean shutdown on SIGTERM/SIGINT
  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
  signals.forEach((signal) => {
    process.on(signal, () => {
      log(`Received ${signal}, shutting down gracefully...`, {});
      process.exit(0);
    });
  });
}
