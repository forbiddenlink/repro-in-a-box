/**
 * Tests for logging and error utilities
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Logger, LogLevel, logger as globalLogger, createChildLogger } from '../src/utils/logger';
import {
  AppError,
  ValidationError,
  ConfigError,
  NotFoundError,
  NetworkError,
  ScanError,
  handleError,
  assert,
  hasErrorCode
} from '../src/utils/errors';

describe('Logger', () => {
  let testLogger: Logger;

  beforeEach(() => {
    testLogger = new Logger({
      level: LogLevel.DEBUG,
      silent: true,
      includeTimestamp: false,
      colors: false
    });
  });

  describe('Log Levels', () => {
    it('should log debug messages', () => {
      testLogger.debug('Test debug message', { key: 'value' });
      const entries = testLogger.getEntries({ level: LogLevel.DEBUG });
      expect(entries).toHaveLength(1);
      expect(entries[0].message).toBe('Test debug message');
      expect(entries[0].context).toEqual({ key: 'value' });
    });

    it('should log info messages', () => {
      testLogger.info('Test info message');
      const entries = testLogger.getEntries({ level: LogLevel.INFO });
      expect(entries).toHaveLength(1);
      expect(entries[0].message).toBe('Test info message');
    });

    it('should log warn messages', () => {
      testLogger.warn('Test warning');
      const entries = testLogger.getEntries({ level: LogLevel.WARN });
      expect(entries).toHaveLength(1);
    });

    it('should log error messages with Error object', () => {
      const error = new Error('Test error');
      testLogger.error('Operation failed', error, { url: 'https://example.com' });
      const entries = testLogger.getEntries({ level: LogLevel.ERROR });
      expect(entries).toHaveLength(1);
      expect(entries[0].error).toBe(error);
      expect(entries[0].context).toEqual({ url: 'https://example.com' });
    });

    it('should respect log level filtering', () => {
      const debugLogger = new Logger({
        level: LogLevel.WARN,
        silent: true
      });

      debugLogger.debug('Should be ignored');
      debugLogger.info('Should be ignored');
      debugLogger.warn('Should be logged');
      debugLogger.error('Should be logged');

      const entries = debugLogger.getEntries();
      expect(entries).toHaveLength(2);
      expect(entries.every(e => e.level === LogLevel.WARN || e.level === LogLevel.ERROR)).toBe(true);
    });
  });

  describe('Timing', () => {
    it('should measure operation duration', async () => {
      const end = testLogger.time('Operation', { operation: 'test' });
      await new Promise(resolve => setTimeout(resolve, 50));
      end();

      const entries = testLogger.getEntries({ level: LogLevel.INFO });
      expect(entries).toHaveLength(1);
      expect(entries[0].message).toContain('completed');
      expect(entries[0].duration).toBeGreaterThanOrEqual(50);
    });
  });

  describe('Entry Retrieval', () => {
    beforeEach(() => {
      testLogger.debug('Debug message', { tag: 'debug' });
      testLogger.info('Info message', { tag: 'info' });
      testLogger.warn('Warn message', { tag: 'warn' });
    });

    it('should retrieve all entries', () => {
      const entries = testLogger.getEntries();
      expect(entries).toHaveLength(3);
    });

    it('should filter entries by level', () => {
      const entries = testLogger.getEntries({ level: LogLevel.INFO });
      expect(entries).toHaveLength(1);
      expect(entries[0].level).toBe(LogLevel.INFO);
    });

    it('should clear entries', () => {
      expect(testLogger.getEntries()).toHaveLength(3);
      testLogger.clear();
      expect(testLogger.getEntries()).toHaveLength(0);
    });
  });

  describe('Configuration', () => {
    it('should update configuration', () => {
      let config = testLogger.getConfig();
      expect(config.level).toBe(LogLevel.DEBUG);

      testLogger.configure({ level: LogLevel.ERROR });
      config = testLogger.getConfig();
      expect(config.level).toBe(LogLevel.ERROR);
    });

    it('should respect verbose mode', () => {
      const verboseLogger = new Logger({
        verbose: true,
        silent: true
      });
      expect(verboseLogger.getConfig().verbose).toBe(true);
    });
  });

  describe('Child Logger', () => {
    it('should create child logger with preset context', () => {
      const child = createChildLogger({ userId: '123', operation: 'scan' });
      child.info('Operation started');

      const entries = child.getEntries();
      expect(entries[0].context).toEqual({ userId: '123', operation: 'scan' });
    });

    it('should merge contexts from parent and child', () => {
      const child = createChildLogger({ userId: '123' });
      child.info('Message', { action: 'test' });

      const entries = child.getEntries();
      expect(entries[0].context).toEqual({ userId: '123', action: 'test' });
    });
  });
});

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create app error with code and exit code', () => {
      const error = new AppError('Test error', 'TEST_ERROR', 1, { details: 'test' });
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.exitCode).toBe(1);
      expect(error.context).toEqual({ details: 'test' });
    });

    it('should create AppError from generic Error', () => {
      const originalError = new Error('Original error');
      const appError = AppError.from(originalError, 'ERROR_CODE', { source: 'import' });
      expect(appError.message).toBe('Original error');
      expect(appError.code).toBe('ERROR_CODE');
      expect(appError.context).toEqual({ source: 'import' });
    });

    it('should detect AppError instances', () => {
      const appErr = new AppError('Test', 'TEST_ERROR');
      const genericErr = new Error('Test');
      expect(AppError.isAppError(appErr)).toBe(true);
      expect(AppError.isAppError(genericErr)).toBe(false);
    });
  });

  describe('Specific Error Types', () => {
    it('ValidationError should use exit code 2', () => {
      const err = new ValidationError('Invalid input', { field: 'maxPages' });
      expect(err.exitCode).toBe(2);
      expect(err.code).toBe('VALIDATION_ERROR');
    });

    it('ConfigError should use exit code 64', () => {
      const err = new ConfigError('Invalid config', { path: '.reprorc.json' });
      expect(err.exitCode).toBe(64);
      expect(err.code).toBe('CONFIG_ERROR');
    });

    it('NotFoundError should use exit code 127', () => {
      const err = new NotFoundError('File not found', { path: '/tmp/bundle.zip' });
      expect(err.exitCode).toBe(127);
      expect(err.code).toBe('NOT_FOUND');
    });

    it('NetworkError should use exit code 69', () => {
      const err = new NetworkError('Connection timeout', { url: 'https://example.com' });
      expect(err.exitCode).toBe(69);
      expect(err.code).toBe('NETWORK_ERROR');
    });

    it('ScanError should use exit code 1', () => {
      const err = new ScanError('Scan failed', { url: 'https://example.com' });
      expect(err.exitCode).toBe(1);
      expect(err.code).toBe('SCAN_ERROR');
    });
  });

  describe('Assertion helper', () => {
    it('should not throw when condition is true', () => {
      expect(() => {
        assert(true, 'This should not throw');
      }).not.toThrow();
    });

    it('should throw ValidationError when condition is false', () => {
      expect(() => {
        assert(false, 'Condition failed', { expected: true });
      }).toThrow(ValidationError);
    });
  });

  describe('Type guards', () => {
    it('should identify error codes', () => {
      const appErr = new AppError('Test', 'TEST_CODE');
      const genericErr = new Error('Test');
      const obj = { code: 'CODE', message: 'msg' };

      expect(hasErrorCode(appErr)).toBe(true);
      expect(hasErrorCode(genericErr)).toBe(false);
      expect(hasErrorCode(obj)).toBe(true);
    });
  });
});

describe('Global Logger', () => {
  it('should export global logger instance', () => {
    expect(globalLogger).toBeInstanceOf(Logger);
    expect(globalLogger.getConfig()).toBeDefined();
  });
});
