import { HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, lastValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { User } from '../models/user';
import { AuthService } from './auth.service';

const LOGIN_URL = `${environment.apiBaseUrl}/api/auth/login`;
const REGISTER_URL = `${environment.apiBaseUrl}/api/auth/register`;
const VERIFY_EMAIL_URL = `${environment.apiBaseUrl}/api/auth/verify-email`;
const RESEND_VERIFICATION_URL = `${environment.apiBaseUrl}/api/auth/resend-verification-email`;
const TOKEN = 'token-value';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('logs in and stores the token and user', async () => {
    const loginPromise = firstValueFrom(service.login('padme', 'padme123'));
    const request = httpMock.expectOne(LOGIN_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ username: 'padme', password: 'padme123' });
    request.flush({
      token: TOKEN,
      user: {
        id: '22222222-0000-0000-0000-000000000000',
        username: 'padme',
        displayName: 'Padmé Amidala',
        role: 0,
      },
    });

    const user = await loginPromise;
    expect(user).toEqual({
      id: '22222222-0000-0000-0000-000000000000',
      username: 'padme',
      displayName: 'Padmé Amidala',
      role: 'Standard',
    });
    expect(service.isLoggedIn()).toBe(true);
    expect(service.getToken()).toBe(TOKEN);
    expect(localStorage.getItem('starwars-timelines.token')).toBe(TOKEN);
  });

  it('maps the admin role', async () => {
    const loginPromise = firstValueFrom(service.login('admin', 'admin123'));
    httpMock.expectOne(LOGIN_URL).flush({
      token: TOKEN,
      user: {
        id: '11111111-0000-0000-0000-000000000000',
        username: 'admin',
        displayName: 'Administrator',
        role: 1,
      },
    });

    const user = await loginPromise;
    expect(user.role).toBe('Admin');
  });

  it('rejects invalid credentials', async () => {
    const loginPromise = firstValueFrom(service.login('padme', 'wrong'));
    httpMock
      .expectOne(LOGIN_URL)
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    await expect(loginPromise).rejects.toThrow('Invalid username or password');
    expect(service.isLoggedIn()).toBe(false);
  });

  it('surfaces the server message for an unverified account', async () => {
    const loginPromise = firstValueFrom(service.login('new-user', 'password123'));
    httpMock
      .expectOne(LOGIN_URL)
      .flush(
        { title: 'Email not verified', detail: 'Please verify your email address before logging in.' },
        { status: 401, statusText: 'Unauthorized' },
      );

    await expect(loginPromise).rejects.toMatchObject({
      message: 'Please verify your email address before logging in.',
      code: 'email-not-verified',
    });
  });

  it('registers a new user with the provided payload', async () => {
    const registerPromise = firstValueFrom(
      service.register({
        username: 'obiwan',
        displayName: 'Obi-Wan Kenobi',
        email: 'obiwan@example.com',
        password: 'kenobi123',
      }),
    );
    const request = httpMock.expectOne(REGISTER_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      username: 'obiwan',
      displayName: 'Obi-Wan Kenobi',
      email: 'obiwan@example.com',
      password: 'kenobi123',
    });
    request.flush({
      userId: 'user-1',
      username: 'obiwan',
      displayName: 'Obi-Wan Kenobi',
      email: 'obiwan@example.com',
    });

    await expect(registerPromise).resolves.toEqual({
      userId: 'user-1',
      username: 'obiwan',
      displayName: 'Obi-Wan Kenobi',
      email: 'obiwan@example.com',
    });
  });

  it('surfaces a server error when registration fails', async () => {
    const registerPromise = firstValueFrom(
      service.register({
        username: 'padme',
        email: 'padme@example.com',
        password: 'password123',
      }),
    );
    httpMock.expectOne(REGISTER_URL).flush(
      { detail: 'A user with this email address is already registered.' },
      { status: 400, statusText: 'Bad Request' },
    );

    await expect(registerPromise).rejects.toThrow(
      'A user with this email address is already registered.',
    );
  });

  it('verifies an email with the provided token', async () => {
    const verifyPromise = firstValueFrom(service.verifyEmail('the-token'));
    const request = httpMock.expectOne(VERIFY_EMAIL_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ token: 'the-token' });
    request.flush(null);

    await expect(verifyPromise).resolves.toBeNull();
  });

  it('surfaces a server error for an invalid verification token', async () => {
    const verifyPromise = firstValueFrom(service.verifyEmail('bad-token'));
    httpMock.expectOne(VERIFY_EMAIL_URL).flush(
      { detail: 'The verification link is invalid or has expired.' },
      { status: 400, statusText: 'Bad Request' },
    );

    await expect(verifyPromise).rejects.toThrow(
      'The verification link is invalid or has expired.',
    );
  });

  it('resends a verification email for the provided identifier', async () => {
    const resendPromise = firstValueFrom(service.resendVerificationEmail('new-user'));
    const request = httpMock.expectOne(RESEND_VERIFICATION_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ usernameOrEmail: 'new-user' });
    request.flush(null);

    await expect(resendPromise).resolves.toBeNull();
  });

  it('surfaces a server error when resending fails', async () => {
    const resendPromise = firstValueFrom(service.resendVerificationEmail('new-user'));
    httpMock.expectOne(RESEND_VERIFICATION_URL).flush(
      { detail: 'Unable to resend the verification email.' },
      { status: 500, statusText: 'Internal Server Error' },
    );

    await expect(resendPromise).rejects.toThrow('Unable to resend the verification email.');
  });

  it('logs out and clears the current user and token', async () => {
    const loginPromise = firstValueFrom(service.login('rey', 'rey123'));
    httpMock.expectOne(LOGIN_URL).flush({
      token: TOKEN,
      user: { id: 'rey', username: 'rey', displayName: 'Rey', role: 0 },
    });
    await loginPromise;

    await lastValueFrom(service.logout());

    expect(service.isLoggedIn()).toBe(false);
    expect(service.getToken()).toBeNull();
  });

  it('exposes the current user through the observable', async () => {
    const users: (User | null)[] = [];
    const subscription = service.currentUser$.subscribe((user) => users.push(user));

    const loginPromise = firstValueFrom(service.login('luke', 'luke123'));
    httpMock.expectOne(LOGIN_URL).flush({
      token: TOKEN,
      user: { id: 'luke', username: 'luke', displayName: 'Luke Skywalker', role: 0 },
    });
    await loginPromise;
    await lastValueFrom(service.logout());
    subscription.unsubscribe();

    expect(users).toEqual([
      null,
      expect.objectContaining({ username: 'luke', displayName: 'Luke Skywalker' }),
      null,
    ]);
  });

  it('restores a stored session on creation', () => {
    localStorage.setItem('starwars-timelines.token', TOKEN);
    localStorage.setItem(
      'starwars-timelines.user',
      JSON.stringify({ id: 'user-padme', username: 'padme', displayName: 'Padmé Amidala' }),
    );

    const restored = new AuthService(TestBed.inject(HttpClient));

    expect(restored.isLoggedIn()).toBe(true);
    expect(restored.getToken()).toBe(TOKEN);
  });
});
