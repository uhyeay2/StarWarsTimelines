import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_WEIGHTS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const CONSOLE_METHODS: Record<LogLevel, keyof Pick<Console, 'debug' | 'info' | 'warn' | 'error'>> = {
  debug: 'debug',
  info: 'info',
  warn: 'warn',
  error: 'error',
};

@Injectable({ providedIn: 'root' })
export class LoggerService {
  private readonly minimumWeight = environment.production
    ? LEVEL_WEIGHTS.warn
    : LEVEL_WEIGHTS.debug;

  debug(message: unknown, ...context: unknown[]): void {
    this.log('debug', message, ...context);
  }

  info(message: unknown, ...context: unknown[]): void {
    this.log('info', message, ...context);
  }

  warn(message: unknown, ...context: unknown[]): void {
    this.log('warn', message, ...context);
  }

  error(message: unknown, ...context: unknown[]): void {
    this.log('error', message, ...context);
  }

  private log(level: LogLevel, message: unknown, ...context: unknown[]): void {
    if (LEVEL_WEIGHTS[level] < this.minimumWeight) {
      return;
    }
    const method = console[CONSOLE_METHODS[level]];
    const timestamp = new Date().toISOString();
    const prefix = `[Star Wars Timelines] ${timestamp} [${level.toUpperCase()}]`;
    if (context.length === 0) {
      method(prefix, message);
    } else {
      method(prefix, message, ...context);
    }
  }
}
