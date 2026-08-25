import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import { LoginPage } from './login-page';

const LOGIN_URL = `${environment.apiBaseUrl}/api/auth/login`;
const RESEND_VERIFICATION_URL = `${environment.apiBaseUrl}/api/auth/resend-verification-email`;

describe('LoginPage', () => {
  let component: LoginPage;
  let fixture: ComponentFixture<LoginPage>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginPage);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the username and password fields', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('input[name="username"]')).toBeTruthy();
    expect(compiled.querySelector('input[name="password"]')).toBeTruthy();
  });

  it('renders a link to the sign-up page', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const link = compiled.querySelector('a[href="/register"]') as HTMLAnchorElement | null;
    expect(link).toBeTruthy();
    expect(link?.textContent).toContain('Sign up');
  });

  it('shows the verification message and resend option for an unverified account', async () => {
    component.username.set('new-user');
    component.password.set('password123');
    fixture.detectChanges();
    component.login();
    httpMock.expectOne(LOGIN_URL).flush(
      {
        title: 'Email not verified',
        detail: 'Please verify your email address before logging in.',
      },
      { status: 401, statusText: 'Unauthorized' },
    );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.error()).toBe('Please verify your email address before logging in.');
    expect(component.needsVerification()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Please verify your email address');
    expect(fixture.nativeElement.textContent).toContain('Resend verification email');
  });

  it('toggles the password visibility', () => {
    const input = fixture.nativeElement.querySelector('input[name="password"]') as HTMLInputElement;
    expect(input.type).toBe('password');

    component.showPassword.set(true);
    fixture.detectChanges();
    expect(input.type).toBe('text');

    component.showPassword.set(false);
    fixture.detectChanges();
    expect(input.type).toBe('password');
  });

  it('resends the verification email for an unverified account', async () => {
    component.username.set('new-user');
    component.password.set('password123');
    fixture.detectChanges();
    component.login();
    httpMock.expectOne(LOGIN_URL).flush(
      {
        title: 'Email not verified',
        detail: 'Please verify your email address before logging in.',
      },
      { status: 401, statusText: 'Unauthorized' },
    );
    await fixture.whenStable();
    fixture.detectChanges();

    component.resendVerification();
    const request = httpMock.expectOne(RESEND_VERIFICATION_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ usernameOrEmail: 'new-user' });
    request.flush(null);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.error()).toBeNull();
    expect(component.verificationSent()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('A new verification email is on its way.');
  });

  it('does not offer a resend option for invalid credentials', async () => {
    component.username.set('padme');
    component.password.set('wrong');
    fixture.detectChanges();
    component.login();
    httpMock.expectOne(LOGIN_URL).flush({}, { status: 401, statusText: 'Unauthorized' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.error()).toBe('Invalid username or password');
    expect(component.needsVerification()).toBe(false);
    expect(fixture.nativeElement.textContent).not.toContain('Resend verification email');
  });

  it('shows the API-backed demo account credentials', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('padme / padme123');
    expect(text).toContain('luke / luke123');
    expect(text).toContain('rey / rey123');
    expect(text).toContain('admin / admin123');
    expect(text).not.toContain('naboo');
  });

  it('shows an error for invalid credentials', async () => {
    component.username.set('padme');
    component.password.set('wrong');
    fixture.detectChanges();
    component.login();
    httpMock.expectOne(LOGIN_URL).flush({}, { status: 401, statusText: 'Unauthorized' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.error()).toBe('Invalid username or password');
    expect(fixture.nativeElement.textContent).toContain('Invalid username or password');
  });

  it('navigates to the library after a successful login', async () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl');

    component.username.set('luke');
    component.password.set('luke123');
    fixture.detectChanges();
    component.login();
    httpMock.expectOne(LOGIN_URL).flush({
      accessToken: 'token-value',
      refreshToken: 'refresh-token-value',
      user: { id: 'luke', username: 'luke', displayName: 'Luke Skywalker', role: 0 },
    });
    httpMock.expectOne(`${environment.apiBaseUrl}/api/users/luke`).flush({
      id: 'luke',
      username: 'luke',
      displayName: 'Luke Skywalker',
      email: 'luke@example.com',
      emailVerified: true,
      role: 0,
    });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.error()).toBeNull();
    expect(navigateSpy).toHaveBeenCalledWith('/library');
  });
});
