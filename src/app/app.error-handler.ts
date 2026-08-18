import { ErrorHandler, Injectable, inject } from '@angular/core';
import { LoggerService } from './services/logging/logger.service';

@Injectable()
export class AppErrorHandler implements ErrorHandler {
  private readonly logger = inject(LoggerService);

  handleError(error: unknown): void {
    this.logger.error('Unhandled application error', { error });
  }
}
