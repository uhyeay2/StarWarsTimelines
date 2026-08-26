import { ErrorHandler, Injectable, inject } from '@angular/core';
import { LoggerService } from '../../core/services/logging/logger.service';

@Injectable({ providedIn: 'root' })
export class AppErrorHandler implements ErrorHandler {
  private readonly logger = inject(LoggerService);

  handleError(error: unknown): void {
    this.logger.error('Unhandled application error', { error });
  }
}
