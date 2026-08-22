import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), provideHttpClient()],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render site navigation', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand')?.textContent).toContain('Star Wars Timelines');
    expect(compiled.querySelector('a[routerLink="/"]')).toBeTruthy();

    const navLabels = Array.from(compiled.querySelectorAll('a.nav-dropdown-toggle')).map((a) =>
      a.textContent?.trim(),
    );
    expect(navLabels).toContain('Timeline');
    expect(navLabels).toContain('Library');
  });

  it('links the user name to account settings when logged in', async () => {
    sessionStorage.setItem('starwars-timelines.token', 'token-value');
    sessionStorage.setItem(
      'starwars-timelines.user',
      JSON.stringify({ id: 'user-padme', username: 'padme', displayName: 'Padmé Amidala', email: 'padme@example.com', emailVerified: true, role: 'Standard' }),
    );

    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('a.user-name[routerLink="/settings"]')).toBeTruthy();
    expect(compiled.querySelector('button.logout-button')).toBeTruthy();
  });

  it('shows the Catalog link for logged-in users', async () => {
    sessionStorage.setItem('starwars-timelines.token', 'token-value');
    sessionStorage.setItem(
      'starwars-timelines.user',
      JSON.stringify({ id: 'user-admin', username: 'admin', displayName: 'Admin', role: 'Admin' }),
    );

    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const navLabels = Array.from(compiled.querySelectorAll('a.nav-dropdown-toggle')).map((a) =>
      a.textContent?.trim(),
    );
    expect(navLabels).toContain('Catalog');
  });

  it('shows the Catalog link for non-admin users', async () => {
    sessionStorage.setItem('starwars-timelines.token', 'token-value');
    sessionStorage.setItem(
      'starwars-timelines.user',
      JSON.stringify({
        id: 'user-padme',
        username: 'padme',
        displayName: 'Padmé Amidala',
        role: 'Standard',
      }),
    );

    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const navLabels = Array.from(compiled.querySelectorAll('a.nav-dropdown-toggle')).map((a) =>
      a.textContent?.trim(),
    );
    expect(navLabels).toContain('Catalog');
  });
});
