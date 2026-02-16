/**
 * Structured logging utility for repro-in-a-box
 * Provides consistent logging across CLI and library code
 * 
 * Usage:
 *   import { logger } from './logger';
 *   logger.info('Scan started', { url: 'https://example.com' });
 *   logger.error('Scan failed', error, { attempts: 3 });
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

/**
 * Log entry with all metadata
 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  error?: Error;
  context?: Record<string, unknown>;
  duration?: number; // in milliseconds
  tags?: string[];
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  level: LogLevel;
  verbose: boolean;
  silent: boolean;
  includeTimestamp: boolean;
  colors: boolean;
}

/**
 * ANSI color codes for terminal output
 */
const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  green: '\x1b[32m'
};

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3
};

/**
 * Structured logger for repro-in-a-box
 */
export class Logger {
  private config: LoggerConfig;
  private entries: LogEntry[] = [];

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: LogLevel.INFO,
      verbose: process.env.VERBOSE === 'true' || process.env.DEBUG === 'true',
      silent: process.env.SILENT === 'true',
      includeTimestamp: true,
      colors: process.stdout.isTTY ?? true,
      ...config
    };
  }

  /**
   * Log debug message (lowest priority)
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, undefined, context);
  }

  /**
   * Log info message
   */
  info(message: string, context?: Record<string, unknown>): void {
    // Extract duration from context if present
    const { duration, ...ctx } = context || {};
    this.log(LogLevel.INFO, message, undefined, ctx, typeof duration === 'number' ? duration : undefined);
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, undefined, context);
  }

  /**
   * Log error message with optional error object
   */
  error(message: string, error?: Error | unknown, context?: Record<string, unknown>): void {
    const err = error instanceof Error ? error : new Error(String(error));
    this.log(LogLevel.ERROR, message, err, context);
  }

  /**
   * Log operation timing
   */
  time(label: string, context?: Record<string, unknown>): () => void {
    const startTime = Date.now();
    return () => {
      const duration = Date.now() - startTime;
      this.info(`${label} completed`, { ...context, duration });
    };
  }

  /**
   * Protected log method (accessible to subclasses and for wrapping)
   */
  protected log(
    level: LogLevel,
    message: string,
    error?: Error,
    context?: Record<string, unknown>,
    duration?: number
  ): void {
    // Check if this level should be logged
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.config.level]) {
      return;
    }

    // Create log entry
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      error,
      context,
      duration,
      tags: extractTags(message)
    };

    // Store entry
    this.entries.push(entry);

    // Output to console if not silent
    if (!this.config.silent) {
      this.outputToConsole(entry);
    }
  }

  /**
   * Format and output log entry to console
   */
  private outputToConsole(entry: LogEntry): void {
    const { message, level, error, context, duration } = entry;
    const isDev = process.env.NODE_ENV === 'development';

    // Build prefix
    let prefix = '';
    if (this.config.includeTimestamp) {
      const time = entry.timestamp.toLocaleTimeString();
      prefix += this.colorize(time, 'dim') + ' ';
    }

    // Add level indicator
    const levelIcon = getLevelIcon(level);
    const levelColor = getLevelColor(level);
    prefix += this.colorize(levelIcon, levelColor);

    // Format main message
    let output = `${prefix} ${message}`;

    // Add context if present
    if (context && Object.keys(context).length > 0) {
      const contextStr = formatContext(context);
      output += ' ' + this.colorize(contextStr, 'dim');
    }

    // Add duration if present
    if (duration !== undefined) {
      output += ' ' + this.colorize(`(${duration}ms)`, 'dim');
    }

    // Output main message
    const outputMethod = level === LogLevel.ERROR ? console.error : console.log;
    outputMethod(output);

    // Output error stack if present and in verbose or error mode
    if (error && (this.config.verbose || level === LogLevel.ERROR)) {
      const stack = error.stack || error.message;
      const indented = stack
        .split('\n')
        .map((line, i) => (i === 0 ? line : '  ' + line))
        .join('\n');
      console.error(this.colorize(indented, 'dim'));
    }
  }

  /**
   * Apply color to text if colors enabled
   */
  private colorize(text: string, color: keyof typeof COLORS | 'dim'): string {
    if (!this.config.colors) return text;
    
    const colorCode = color === 'dim' ? COLORS.dim : COLORS[color as keyof typeof COLORS];
    if (!colorCode) return text;
    
    return `${colorCode}${text}${COLORS.reset}`;
  }

  /**
   * Get all logged entries
   */
  getEntries(filter?: { level?: LogLevel; tag?: string }): LogEntry[] {
    if (!filter) return [...this.entries];
    
    return this.entries.filter(entry => {
      if (filter.level && entry.level !== filter.level) return false;
      if (filter.tag && !entry.tags?.includes(filter.tag)) return false;
      return true;
    });
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries = [];
  }

  /**
   * Update configuration
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }
}

/**
 * Global logger instance
 */
export const logger = new Logger();

/**
 * Helper: Get icon for log level
 */
function getLevelIcon(level: LogLevel): string {
  switch (level) {
    case LogLevel.DEBUG:
      return '🐛';
    case LogLevel.INFO:
      return 'ℹ️';
    case LogLevel.WARN:
      return '⚠️';
    case LogLevel.ERROR:
      return '❌';
  }
}

/**
 * Helper: Get color name for log level
 */
function getLevelColor(level: LogLevel): keyof typeof COLORS {
  switch (level) {
    case LogLevel.DEBUG:
      return 'cyan';
    case LogLevel.INFO:
      return 'blue';
    case LogLevel.WARN:
      return 'yellow';
    case LogLevel.ERROR:
      return 'red';
  }
}

/**
 * Helper: Extract tags from message (e.g., [tag] prefix)
 */
function extractTags(message: string): string[] {
  const match = message.match(/^\[([^\]]+)\]/);
  if (!match) return [];
  return match[1].split(',').map(t => t.trim());
}

/**
 * Helper: Format context object for logging
 */
function formatContext(context: Record<string, unknown>): string {
  const entries = Object.entries(context)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => {
      if (typeof v === 'string' && v.length > 50) {
        return `${k}=${v.substring(0, 47)}...`;
      }
      return `${k}=${JSON.stringify(v)}`;
    });
  
  return entries.length > 0 ? `{${entries.join(', ')}}` : '';
}

/**
 * Child logger with preset context
 */
class ChildLogger extends Logger {
  constructor(baseConfig: LoggerConfig, private context: Record<string, unknown>) {
    super(baseConfig);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    super.debug(message, { ...this.context, ...context });
  }

  info(message: string, context?: Record<string, unknown>): void {
    super.info(message, { ...this.context, ...context });
  }

  warn(message: string, context?: Record<string, unknown>): void {
    super.warn(message, { ...this.context, ...context });
  }

  error(message: string, error?: Error | unknown, context?: Record<string, unknown>): void {
    super.error(message, error, { ...this.context, ...context });
  }
}

/**
 * Helper: Create a child logger with preset context
 */
export function createChildLogger(context: Record<string, unknown>): Logger {
  return new ChildLogger(logger.getConfig(), context);
}
