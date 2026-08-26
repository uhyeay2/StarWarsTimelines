import { Routes } from '@angular/router';
import { authGuard } from './features/auth/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/landing/pages/landing-page/landing-page').then((m) => m.LandingPage),
  },
  {
    path: 'timeline',
    loadComponent: () =>
      import('./features/timeline/components/timeline/timeline').then((m) => m.Timeline),
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/pages/login-page/login-page').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/pages/register-page/register-page').then((m) => m.RegisterPage),
  },
  {
    path: 'verify-email',
    loadComponent: () =>
      import('./features/auth/pages/verify-email-page/verify-email-page').then(
        (m) => m.VerifyEmailPage,
      ),
  },
  {
    path: 'library',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/library/pages/library-page/library-page').then((m) => m.LibraryPage),
      },
      {
        path: 'tracked',
        loadComponent: () =>
          import('./features/library/pages/tracked-events-page/tracked-events-page').then(
            (m) => m.TrackedEventsPage,
          ),
      },
      {
        path: 'wish-list',
        loadComponent: () =>
          import('./features/library/pages/wish-list-page/wish-list-page').then(
            (m) => m.WishListPage,
          ),
      },
      {
        path: 'timeline',
        loadComponent: () =>
          import('./features/timeline/pages/known-timeline-page/known-timeline-page').then(
            (m) => m.KnownTimelinePage,
          ),
      },
    ],
  },
  {
    path: 'settings',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/account/pages/account-settings-page/account-settings-page').then(
        (m) => m.AccountSettingsPage,
      ),
  },
  {
    path: 'catalog',
    loadComponent: () =>
      import('./features/catalog/pages/catalog-page/catalog-page').then((m) => m.CatalogPage),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
