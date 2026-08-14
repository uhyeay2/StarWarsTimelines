import { Routes } from '@angular/router';

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
    path: '**',
    redirectTo: '',
  },
];
