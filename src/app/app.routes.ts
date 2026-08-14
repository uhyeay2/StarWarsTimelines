import { Routes } from '@angular/router';
import { authGuard } from './auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/landing-page/landing-page').then((m) => m.LandingPage),
  },
  {
    path: 'timeline',
    loadComponent: () => import('./components/timeline/timeline').then((m) => m.Timeline),
  },
  {
    path: 'login',
    loadComponent: () => import('./components/login-page/login-page').then((m) => m.LoginPage),
  },
  {
    path: 'library',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./components/library-page/library-page').then((m) => m.LibraryPage),
      },
      {
        path: 'tracked',
        loadComponent: () =>
          import('./components/tracked-events-page/tracked-events-page').then(
            (m) => m.TrackedEventsPage,
          ),
      },
      {
        path: 'timeline',
        loadComponent: () =>
          import('./components/known-timeline-page/known-timeline-page').then(
            (m) => m.KnownTimelinePage,
          ),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
