/**
 * @fileoverview Centralized logging service for the Star Wars Timelines application.
 *
 * Provides configurable log levels, structured context handling, external log
 * sinks, colorized console output, performance safeguards, silent mode, and
 * console grouping support.
 *
 * **Configuration:** Provide a {@link LogConfig} object via the
 * {@link LOG_CONFIG} injection token to customise behaviour at startup.
 * When no token is provided, sensible defaults are derived from
 * `environment.production`.
 *
 * **External sinks:** Register {@link LogSink} implementations to forward
 * log entries to remote monitoring services (e.g. Application Insights,
 * Sentry). Sinks receive entries asynchronously via `queueMicrotask` so
 * they never block the main thread.
 *
 * **Performance safeguards:** Object serialization is depth-limited and
 * string-truncated to prevent expensive console output from large payloads.
 *
 * **Colorized output:** In development, console output uses CSS-styled
 * `%c` formatting for improved readability. In production, plain text
 * is used.
 *
 * @example
 * ```ts
 * // Basic usage
 * logger.info('User logged in', { userId: '123', method: 'OAuth' });
 *
 * // Level override for an operation
 * const opLogger = logger.withLevel('debug');
 * opLogger.debug('Detailed trace');
 *
 * // Grouping
 * logger.group('Sync operation', () => {
 *   logger.info('Starting sync');
 *   logger.info('Sync complete');
 * });
 * ```
 */

import { Inject, Injectable, InjectionToken, Optional } from '@angular/core';
import { environment } from '../../../environments/environment';

// ─── Types ──────────────────────────────────────────────────────────────────

/** Log severity levels, ordered from most verbose to least. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * A structured log entry forwarded to external sinks.
 *
 * Each entry captures the level, human-readable message, ISO-8601
 * timestamp, and optional structured metadata.
 */
export interface LogEntry {
  /** The severity level of this entry. */
  level: LogLevel;
  /** A human-readable description of the event. */
  message: string;
  /** ISO-8601 timestamp of when the entry was created. */
  timestamp: string;
  /** Optional structured metadata attached to the entry. */
  context?: Record<string, unknown>;
}

/**
 * An external log sink that receives structured log entries.
 *
 * Implement this interface to forward logs to remote monitoring services
 * such as Application Insights, Sentry, or a custom logging endpoint.
 */
export interface LogSink {
  /**
   * Processes a single log entry.
   *
   * Implementations should be non-blocking. Errors thrown inside `log`
   * are caught by the {@link LoggerService} and logged to `console.error`.
   *
   * @param entry The structured log entry to process.
   */
  log(entry: LogEntry): void;

  /**
   * Flushes any buffered entries to the remote service.
   *
   * Optional — only needed when the sink batches entries. Called by
   * {@link LoggerService.flush}.
   *
   * @returns A promise that resolves when the flush is complete.
   */
  flush?(): Promise<void>;
}

/**
 * Configuration for the {@link LoggerService}.
 *
 * All properties are optional. When omitted, defaults are derived from
 * `environment.production`.
 */
export interface LogConfig {
  /**
   * Minimum log level to output.
   * @default `'warn'` in production, `'debug'` otherwise.
   */
  minLevel?: LogLevel;

  /**
   * External sinks to forward log entries to.
   * @default `[]`
   */
  sinks?: LogSink[];

  /**
   * When `true`, disables all console output and sink forwarding.
   * @default `false`
   */
  silent?: boolean;

  /**
   * When `true`, applies CSS-styled `%c` formatting to console output.
   * @default `!environment.production`
   */
  colorize?: boolean;

  /**
   * Maximum object serialization depth before values are replaced with
   * `'[Depth limit exceeded]'`.
   * @default `5`
   */
  maxDepth?: number;

  /**
   * Maximum string length before truncation with `'...'`.
   * @default `1000`
   */
  maxStringLength?: number;
}

/** Injection token for providing a {@link LogConfig} at the application level. */
export const LOG_CONFIG = new InjectionToken<LogConfig>('LOG_CONFIG');

// ─── Constants ──────────────────────────────────────────────────────────────

/** Numeric weights for each log level, used for filtering. */
const LEVEL_WEIGHTS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/** Maps each log level to the corresponding `console` method name. */
const CONSOLE_METHODS: Record<LogLevel, keyof Pick<Console, 'debug' | 'info' | 'warn' | 'error'>> = {
  debug: 'debug',
  info: 'info',
  warn: 'warn',
  error: 'error',
};

/** CSS styles applied to each log level when `colorize` is enabled. */
const LEVEL_STYLES: Record<LogLevel, string> = {
  debug: 'color: #888',
  info: 'color: #0066cc',
  warn: 'color: #cc6600; font-weight: bold',
  error: 'color: #cc0000; font-weight: bold',
};

/** Default configuration merged with any user-provided overrides. */
const DEFAULT_CONFIG: Required<LogConfig> = {
  minLevel: environment.production ? 'warn' : 'debug',
  sinks: [],
  silent: false,
  colorize: !environment.production,
  maxDepth: 5,
  maxStringLength: 1000,
};

// ─── Serialization ──────────────────────────────────────────────────────────

/**
 * Recursively serializes a value with depth and string-length limits.
 *
 * Handles circular references, `BigInt`, `Symbol`, `Function`, `Error`,
 * arrays, and plain objects. Values exceeding `maxDepth` are replaced
 * with `'[Depth limit exceeded]'`. Strings longer than `maxStringLength`
 * are truncated with `'...'`.
 *
 * @param value           The value to serialize.
 * @param maxDepth        Maximum recursion depth.
 * @param maxStringLength Maximum string length before truncation.
 * @param depth           Current recursion depth (used internally).
 * @param seen            Set of already-visited objects (for circular detection).
 * @returns A safe, serializable representation of the value.
 */
function safeSerialize(
  value: unknown,
  maxDepth: number,
  maxStringLength: number,
  depth = 0,
  seen?: WeakSet<object>,
): unknown {
  if (depth > maxDepth) return '[Depth limit exceeded]';
  if (value === null) return null;
  if (value === undefined) return '[undefined]';

  const type = typeof value;

  if (type === 'bigint') return `${value}n`;
  if (type === 'symbol') return value.toString();
  if (type === 'function') return `[Function: ${(value as Function).name || 'anonymous'}]`;

  if (type === 'string') {
    const str = value as string;
    return str.length > maxStringLength ? str.slice(0, maxStringLength) + '...' : str;
  }

  if (type === 'number' || type === 'boolean') return value;

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack?.split('\n').slice(0, 5).join('\n'),
    };
  }

  if (typeof value === 'object') {
    if (!seen) seen = new WeakSet();
    if (seen.has(value as object)) return '[Circular]';
    seen.add(value as object);

    if (Array.isArray(value)) {
      return value.map((item) => safeSerialize(item, maxDepth, maxStringLength, depth + 1, seen));
    }

    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = safeSerialize(val, maxDepth, maxStringLength, depth + 1, seen);
    }
    return result;
  }

  return String(value);
}

// ─── LoggerService ──────────────────────────────────────────────────────────

/**
 * Centralized logging service with configurable levels, structured context,
 * external sinks, colorized output, performance safeguards, silent mode,
 * and console grouping.
 *
 * This is a root-scoped singleton (`providedIn: 'root'`).
 *
 * @see {@link LOG_CONFIG} for the injection token.
 * @see {@link LogSink} for integrating external monitoring services.
 */
@Injectable({ providedIn: 'root' })
export class LoggerService {
  /** Merged configuration (defaults + user-provided overrides). */
  private readonly config: Required<LogConfig>;

  /**
   * Creates a new {@link LoggerService}.
   *
   * @param config  Optional configuration provided via {@link LOG_CONFIG}.
   *                When `null` (no provider), the default config is used.
   */
  constructor(@Optional() @Inject(LOG_CONFIG) config: LogConfig | null) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ─── Public API ───────────────────────────────────────────────────────

  /**
   * Logs a message at **debug** level.
   *
   * Typically used for detailed diagnostic information intended for
   * developers. Suppressed in production by default.
   *
   * @param message  A human-readable description of the event.
   * @param context Optional structured metadata attached to the entry.
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  /**
   * Logs a message at **info** level.
   *
   * Used for general informational messages about application state
   * or significant operations.
   *
   * @param message  A human-readable description of the event.
   * @param context Optional structured metadata attached to the entry.
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  /**
   * Logs a message at **warn** level.
   *
   * Used for potentially harmful situations that are not errors but
   * may require attention.
   *
   * @param message  A human-readable description of the event.
   * @param context Optional structured metadata attached to the entry.
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  /**
   * Logs a message at **error** level.
   *
   * Used for error events that might still allow the application to
   * continue, but should be investigated.
   *
   * @param message  A human-readable description of the event.
   * @param context Optional structured metadata attached to the entry.
   */
  error(message: string, context?: Record<string, unknown>): void {
    this.log('error', message, context);
  }

  /**
   * Creates a bound logger with a specific minimum level, ignoring the
   * global configuration. Useful for temporarily enabling verbose logging
   * for a specific operation without affecting other parts of the app.
   *
   * @param level The minimum level for the returned logger.
   * @returns An object with `debug`, `info`, `warn`, and `error` methods.
   *
   * @example
   * ```ts
   * const opLogger = logger.withLevel('debug');
   * opLogger.debug('Detailed trace'); // Logged even if global level is 'warn'
   * ```
   */
  withLevel(level: LogLevel): Pick<LoggerService, 'debug' | 'info' | 'warn' | 'error'> {
    const minWeight = LEVEL_WEIGHTS[level];
    return {
      debug: (message: string, context?: Record<string, unknown>): void => {
        if (LEVEL_WEIGHTS.debug >= minWeight) this.log('debug', message, context);
      },
      info: (message: string, context?: Record<string, unknown>): void => {
        if (LEVEL_WEIGHTS.info >= minWeight) this.log('info', message, context);
      },
      warn: (message: string, context?: Record<string, unknown>): void => {
        if (LEVEL_WEIGHTS.warn >= minWeight) this.log('warn', message, context);
      },
      error: (message: string, context?: Record<string, unknown>): void => {
        if (LEVEL_WEIGHTS.error >= minWeight) this.log('error', message, context);
      },
    };
  }

  /**
   * Executes `fn` inside a `console.group` block for multi-line
   * contextual logs. The group is always closed via `console.groupEnd`,
   * even if `fn` throws.
   *
   * In silent mode, `fn` is called directly without group wrappers.
   *
   * @param label The group label displayed in the console.
   * @param fn    The function to execute within the group.
   */
  group(label: string, fn: () => void): void {
    if (this.config.silent) {
      fn();
      return;
    }
    console.group(label);
    try {
      fn();
    } finally {
      console.groupEnd();
    }
  }

  /**
   * Executes `fn` inside a `console.groupCollapsed` block. Identical
   * to {@link group} but the group starts collapsed in the console.
   *
   * In silent mode, `fn` is called directly without group wrappers.
   *
   * @param label The group label displayed in the console.
   * @param fn    The function to execute within the group.
   */
  groupCollapsed(label: string, fn: () => void): void {
    if (this.config.silent) {
      fn();
      return;
    }
    console.groupCollapsed(label);
    try {
      fn();
    } finally {
      console.groupEnd();
    }
  }

  /**
   * Flushes all registered sinks, ensuring any buffered entries are
   * delivered to external monitoring services.
   *
   * @returns A promise that resolves when all sinks have been flushed.
   */
  async flush(): Promise<void> {
    await Promise.all(
      this.config.sinks.map((sink) => sink.flush?.() ?? Promise.resolve()),
    );
  }

  // ─── Internals ────────────────────────────────────────────────────────

  /**
   * Core logging method. Checks the minimum level, formats the console
   * output, and forwards to sinks asynchronously.
   *
   * @param level   The log level.
   * @param message A human-readable message.
   * @param context Optional structured metadata.
   */
  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (LEVEL_WEIGHTS[level] < LEVEL_WEIGHTS[this.config.minLevel]) return;
    if (this.config.silent) return;

    const timestamp = new Date().toISOString();
    const prefix = `[Star Wars Timelines] ${timestamp} [${level.toUpperCase()}]`;

    this.writeToConsole(level, prefix, message, context);
    this.forwardToSinks(level, message, timestamp, context);
  }

  /**
   * Writes a formatted log entry to the browser console.
   *
   * When `colorize` is enabled, uses CSS `%c` formatting for coloured
   * output. Otherwise, falls back to plain text with the structured
   * context passed as an additional argument.
   *
   * @param level   The log level.
   * @param prefix  The formatted timestamp and level prefix.
   * @param message The log message.
   * @param context Optional structured metadata.
   */
  private writeToConsole(
    level: LogLevel,
    prefix: string,
    message: string,
    context?: Record<string, unknown>,
  ): void {
    const method = console[CONSOLE_METHODS[level]];
    const serialized = context
      ? safeSerialize(context, this.config.maxDepth, this.config.maxStringLength)
      : undefined;

    if (this.config.colorize) {
      const fmt = `%c${prefix} %c${message}`;
      if (serialized !== undefined) {
        method(fmt, LEVEL_STYLES[level], 'color: inherit', serialized);
      } else {
        method(fmt, LEVEL_STYLES[level], 'color: inherit');
      }
    } else {
      if (serialized !== undefined) {
        method(prefix, message, serialized);
      } else {
        method(prefix, message);
      }
    }
  }

  /**
   * Asynchronously forwards a log entry to all registered sinks via
   * `queueMicrotask` so that sink processing never blocks the main thread.
   *
   * Errors thrown by individual sinks are caught and reported to
   * `console.error` to prevent one failing sink from affecting others.
   *
   * @param level     The log level.
   * @param message   The log message.
   * @param timestamp ISO-8601 timestamp string.
   * @param context   Optional structured metadata.
   */
  private forwardToSinks(
    level: LogLevel,
    message: string,
    timestamp: string,
    context?: Record<string, unknown>,
  ): void {
    if (this.config.sinks.length === 0) return;

    const entry: LogEntry = { level, message, timestamp, context };

    queueMicrotask(() => {
      for (const sink of this.config.sinks) {
        try {
          sink.log(entry);
        } catch {
          console.error('[LoggerService] Sink failed to process log entry');
        }
      }
    });
  }
}
