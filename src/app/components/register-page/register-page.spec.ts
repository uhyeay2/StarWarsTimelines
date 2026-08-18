import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { RegisterPage } from './register-page';

const REGISTER_URL = `${environment.apiBaseUrl}/api/auth/register`;

describe('RegisterPage', () => {
  let component: RegisterPage;
  let fixture: ComponentFixture<RegisterPage>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [RegisterPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterPage);
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

  it('renders the registration fields', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('input[name="username"]')).toBeTruthy();
    expect(compiled.querySelector('input[name="displayName"]')).toBeTruthy();
    expect(compiled.querySelector('input[name="email"]')).toBeTruthy();
    expect(compiled.querySelector('input[name="password"]')).toBeTruthy();
    expect(compiled.querySelector('input[name="confirmPassword"]')).toBeTruthy();
  });

  it('shows a validation error for a missing username', () => {
    component.email.set('obiwan@example.com');
    component.password.set('kenobi123');
    component.confirmPassword.set('kenobi123');
    component.submit();

    expect(component.error()).toBe('A username is required.');
  });

  it('shows a validation error for an invalid email', () => {
    component.username.set('obiwan');
    component.email.set('not-an-email');
    component.password.set('kenobi123');
    component.confirmPassword.set('kenobi123');
    component.submit();

    expect(component.error()).toBe('Enter a valid email address.');
  });

  it('shows a validation error for a short password', () => {
    component.username.set('obiwan');
    component.email.set('obiwan@example.com');
    component.password.set('12345');
    component.confirmPassword.set('12345');
    component.submit();

    expect(component.error()).toBe('The password must be at least six characters long.');
  });

  it('shows a validation error when the passwords do not match', () => {
    component.username.set('obiwan');
    component.email.set('obiwan@example.com');
    component.password.set('kenobi123');
    component.confirmPassword.set('different');
    fixture.detectChanges();
    component.submit();
    fixture.detectChanges();

    expect(component.error()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('The passwords do not match.');
  });

  it('warns live while typing a confirmation password that does not match', () => {
    component.password.set('kenobi123');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('The passwords do not match.');

    component.confirmPassword.set('kenobi');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('The passwords do not match.');

    component.confirmPassword.set('kenobi123');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('The passwords do not match.');
  });

  it('does not submit while the confirmation password does not match', async () => {
    component.username.set('obiwan');
    component.email.set('obiwan@example.com');
    component.password.set('kenobi123');
    component.confirmPassword.set('different');
    fixture.detectChanges();
    component.submit();

    expect(component.submitting()).toBe(false);
    httpMock.expectNone(REGISTER_URL);
  });

  it('toggles the password visibility', () => {
    const passwordInput = fixture.nativeElement.querySelector('input[name="password"]') as HTMLInputElement;
    const confirmInput = fixture.nativeElement.querySelector('input[name="confirmPassword"]') as HTMLInputElement;
    expect(passwordInput.type).toBe('password');
    expect(confirmInput.type).toBe('password');

    component.showPassword.set(true);
    component.showConfirmPassword.set(true);
    fixture.detectChanges();
    expect(passwordInput.type).toBe('text');
    expect(confirmInput.type).toBe('text');

    component.showConfirmPassword.set(false);
    fixture.detectChanges();
    expect(passwordInput.type).toBe('text');
    expect(confirmInput.type).toBe('password');
  });

  it('registers a user and shows the verification message', async () => {
    component.username.set('obiwan');
    component.displayName.set('Obi-Wan Kenobi');
    component.email.set('obiwan@example.com');
    component.password.set('kenobi123');
    component.confirmPassword.set('kenobi123');
    fixture.detectChanges();
    component.submit();

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
    await new Promise((resolve) => setTimeout(resolve, 100));
    fixture.detectChanges();

    expect(component.registeredEmail()).toBe('obiwan@example.com');
    expect(fixture.nativeElement.textContent).toContain('Check your inbox');
    expect(fixture.nativeElement.textContent).toContain('obiwan@example.com');
  });

  it('surfaces a server error for a duplicate email', async () => {
    component.username.set('padme');
    component.email.set('padme@example.com');
    component.password.set('password123');
    component.confirmPassword.set('password123');
    fixture.detectChanges();
    component.submit();

    httpMock.expectOne(REGISTER_URL).flush(
      { detail: 'A user with this email address is already registered.' },
      { status: 400, statusText: 'Bad Request' },
    );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.error()).toBe('A user with this email address is already registered.');
    expect(fixture.nativeElement.textContent).toContain(
      'A user with this email address is already registered.',
    );
  });
});
