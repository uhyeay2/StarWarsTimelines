import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, ErrorHandler, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { AppErrorHandler } from './app.error-handler';
import { authInterceptor } from './auth.interceptor';
import { httpErrorInterceptor } from './http-error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: ErrorHandler, useClass: AppErrorHandler },
    provideHttpClient(withInterceptors([authInterceptor, httpErrorInterceptor])),
    provideRouter(routes)
  ]
};
