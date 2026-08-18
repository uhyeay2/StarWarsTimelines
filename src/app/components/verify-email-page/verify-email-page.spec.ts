import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { environment } from '../../../environments/environment';
import { VerifyEmailPage } from './verify-email-page';

const VERIFY_URL = `${environment.apiBaseUrl}/api/auth/verify-email`;

function mockRoute(token: string | null): { snapshot: { queryParamMap: { get: (key: string) => string | null } } } {
  return {
    snapshot: {
      queryParamMap: {
        get: (key: string) => (key === 'token' ? token : null),
      },
    },
  };
}

describe('VerifyEmailPage', () => {
  let fixture: ComponentFixture<VerifyEmailPage>;
  let component: VerifyEmailPage;
  let httpMock: HttpTestingController;
  let tokenValue: string | null = null;

  beforeEach(async () => {
    sessionStorage.clear();
    tokenValue = null;
    await TestBed.configureTestingModule({
      imports: [VerifyEmailPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useFactory: () => mockRoute(tokenValue) },
      ],
    }).compileComponents();
  });

  function createFixture(token: string | null): void {
    tokenValue = token;
    fixture = TestBed.createComponent(VerifyEmailPage);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  }

  afterEach(() => {
    httpMock?.verify();
  });

  it('should create', () => {
    createFixture(null);
    expect(component).toBeTruthy();
  });

  it('shows an error when the token is missing from the link', () => {
    createFixture(null);

    expect(component.verifying()).toBe(false);
    expect(component.error()).toContain('The verification link is missing');
    expect(fixture.nativeElement.textContent).toContain('Verification failed');
  });

  it('verifies the email and shows the success state', async () => {
    createFixture('the-token');
    const request = httpMock.expectOne(VERIFY_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ token: 'the-token' });
    request.flush(null);
    await new Promise((resolve) => setTimeout(resolve, 100));
    fixture.detectChanges();

    expect(component.verifying()).toBe(false);
    expect(component.success()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Email verified');
    expect(fixture.nativeElement.textContent).toContain('Go to log in');
  });

  it('surfaces a server error for an invalid token', async () => {
    createFixture('expired-token');
    httpMock.expectOne(VERIFY_URL).flush(
      { detail: 'The verification link is invalid or has expired.' },
      { status: 400, statusText: 'Bad Request' },
    );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.success()).toBe(false);
    expect(component.error()).toBe('The verification link is invalid or has expired.');
    expect(fixture.nativeElement.textContent).toContain('Verification failed');
  });
});
