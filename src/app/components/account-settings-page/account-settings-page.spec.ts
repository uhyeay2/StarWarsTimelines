import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AccountSettingsPage } from './account-settings-page';

const USER_ID = '22222222-2222-2222-2222-222222222222';
const ACCOUNT_URL = `${environment.apiBaseUrl}/api/users/${USER_ID}`;

const ACCOUNT_RESPONSE = {
  id: USER_ID,
  username: 'padme',
  displayName: 'Padmé Amidala',
  email: 'padme@example.com',
  emailVerified: true,
  role: 0,
};

function loginAsPadme(): void {
  sessionStorage.setItem('starwars-timelines.token', 'token-value');
  sessionStorage.setItem(
    'starwars-timelines.user',
    JSON.stringify({ id: USER_ID, username: 'padme', displayName: 'Padmé Amidala', email: 'padme@example.com', emailVerified: true, role: 'Standard' }),
  );
}

describe('AccountSettingsPage', () => {
  let component: AccountSettingsPage;
  let fixture: ComponentFixture<AccountSettingsPage>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [AccountSettingsPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  afterEach(() => {
    httpMock?.verify();
  });

  function createComponent(): void {
    fixture = TestBed.createComponent(AccountSettingsPage);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  }

  it('should create', () => {
    createComponent();
    expect(component).toBeTruthy();
  });

  it('shows a login prompt when not logged in', () => {
    createComponent();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Log in to manage your account settings.',
    );
    expect(fixture.nativeElement.querySelector('a[href="/login"]')).toBeTruthy();
  });

  it('loads and renders the account details', async () => {
    loginAsPadme();
    createComponent();
    fixture.detectChanges();

    httpMock.expectOne(ACCOUNT_URL).flush(ACCOUNT_RESPONSE);
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('padme');
    expect(compiled.querySelector('.settings-username')?.textContent).toContain('padme');
    expect(
      (compiled.querySelector('input[name="displayName"]') as HTMLInputElement).value,
    ).toBe('Padmé Amidala');
    expect((compiled.querySelector('input[name="email"]') as HTMLInputElement).value).toBe(
      'padme@example.com',
    );
    expect(compiled.textContent).toContain('Verified');
    expect(component.account()).toEqual(
      expect.objectContaining({
        username: 'padme',
        displayName: 'Padmé Amidala',
        email: 'padme@example.com',
        emailVerified: true,
      }),
    );
  });

  it('surfaces an error when the account cannot be loaded', () => {
    loginAsPadme();
    createComponent();
    fixture.detectChanges();

    httpMock.expectOne(ACCOUNT_URL).flush(
      { detail: 'No user with the requested identifier was found.' },
      { status: 404, statusText: 'Not Found' },
    );
    fixture.detectChanges();

    expect(component.loadError()).toBe('No user with the requested identifier was found.');
    expect(fixture.nativeElement.textContent).toContain(
      'No user with the requested identifier was found.',
    );
  });

  it('rejects a blank display name', () => {
    loginAsPadme();
    createComponent();
    fixture.detectChanges();
    httpMock.expectOne(ACCOUNT_URL).flush(ACCOUNT_RESPONSE);
    fixture.detectChanges();

    component.displayName.set('   ');
    component.updateDisplayName();
    fixture.detectChanges();

    expect(component.displayNameError()).toBe('A display name is required.');
    httpMock.expectNone(`${ACCOUNT_URL}/display-name`);
  });

  it('updates the display name and stores the updated user', async () => {
    loginAsPadme();
    createComponent();
    fixture.detectChanges();
    httpMock.expectOne(ACCOUNT_URL).flush(ACCOUNT_RESPONSE);
    fixture.detectChanges();

    component.displayName.set('Queen Amidala');
    component.updateDisplayName();
    const request = httpMock.expectOne(`${ACCOUNT_URL}/display-name`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ displayName: 'Queen Amidala' });
    request.flush({ ...ACCOUNT_RESPONSE, displayName: 'Queen Amidala' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.displayNameSaved()).toBe(true);
    expect(component.account()?.displayName).toBe('Queen Amidala');
    expect(fixture.nativeElement.textContent).toContain('Your display name was updated.');
    expect(JSON.parse(sessionStorage.getItem('starwars-timelines.user')!).displayName).toBe(
      'Queen Amidala',
    );
  });

  it('rejects an invalid email address', () => {
    loginAsPadme();
    createComponent();
    fixture.detectChanges();
    httpMock.expectOne(ACCOUNT_URL).flush(ACCOUNT_RESPONSE);
    fixture.detectChanges();

    component.email.set('not-an-email');
    component.updateEmail();
    fixture.detectChanges();

    expect(component.emailError()).toBe('Enter a valid email address.');
    httpMock.expectNone(`${ACCOUNT_URL}/email`);
  });

  it('updates the email address and shows the verification message', async () => {
    loginAsPadme();
    createComponent();
    fixture.detectChanges();
    httpMock.expectOne(ACCOUNT_URL).flush(ACCOUNT_RESPONSE);
    fixture.detectChanges();

    component.email.set('queen@example.com');
    component.updateEmail();
    const request = httpMock.expectOne(`${ACCOUNT_URL}/email`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ email: 'queen@example.com' });
    request.flush({ ...ACCOUNT_RESPONSE, email: 'queen@example.com', emailVerified: false });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.emailSaved()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain(
      'We emailed a verification link to queen@example.com.',
    );
    expect(fixture.nativeElement.textContent).toContain('Unverified');
  });

  it('surfaces a server error for a duplicate email', async () => {
    loginAsPadme();
    createComponent();
    fixture.detectChanges();
    httpMock.expectOne(ACCOUNT_URL).flush(ACCOUNT_RESPONSE);
    fixture.detectChanges();

    component.email.set('taken@example.com');
    component.updateEmail();
    httpMock.expectOne(`${ACCOUNT_URL}/email`).flush(
      { detail: 'A user with this email address is already registered.' },
      { status: 400, statusText: 'Bad Request' },
    );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.emailError()).toBe('A user with this email address is already registered.');
    expect(fixture.nativeElement.textContent).toContain(
      'A user with this email address is already registered.',
    );
  });

  it('rejects a missing current password', () => {
    loginAsPadme();
    createComponent();
    fixture.detectChanges();
    httpMock.expectOne(ACCOUNT_URL).flush(ACCOUNT_RESPONSE);
    fixture.detectChanges();

    component.newPassword.set('noblequeen1');
    component.confirmPassword.set('noblequeen1');
    component.updatePassword();
    fixture.detectChanges();

    expect(component.passwordError()).toBe('Enter your current password.');
    httpMock.expectNone(`${ACCOUNT_URL}/password`);
  });

  it('rejects a short new password', () => {
    loginAsPadme();
    createComponent();
    fixture.detectChanges();
    httpMock.expectOne(ACCOUNT_URL).flush(ACCOUNT_RESPONSE);
    fixture.detectChanges();

    component.currentPassword.set('padme123');
    component.newPassword.set('12345');
    component.confirmPassword.set('12345');
    component.updatePassword();
    fixture.detectChanges();

    expect(component.passwordError()).toBe(
      'The new password must be at least six characters long.',
    );
    httpMock.expectNone(`${ACCOUNT_URL}/password`);
  });

  it('rejects a mismatched new password', () => {
    loginAsPadme();
    createComponent();
    fixture.detectChanges();
    httpMock.expectOne(ACCOUNT_URL).flush(ACCOUNT_RESPONSE);
    fixture.detectChanges();

    component.currentPassword.set('padme123');
    component.newPassword.set('noblequeen1');
    component.confirmPassword.set('different1');
    component.updatePassword();
    fixture.detectChanges();

    expect(component.passwordError()).toBe('The passwords do not match.');
    httpMock.expectNone(`${ACCOUNT_URL}/password`);
  });

  it('changes the password and clears the form', async () => {
    loginAsPadme();
    createComponent();
    fixture.detectChanges();
    httpMock.expectOne(ACCOUNT_URL).flush(ACCOUNT_RESPONSE);
    fixture.detectChanges();

    component.currentPassword.set('padme123');
    component.newPassword.set('noblequeen1');
    component.confirmPassword.set('noblequeen1');
    component.updatePassword();
    const request = httpMock.expectOne(`${ACCOUNT_URL}/password`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      currentPassword: 'padme123',
      newPassword: 'noblequeen1',
    });
    request.flush(null);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.passwordSaved()).toBe(true);
    expect(component.currentPassword()).toBe('');
    expect(component.newPassword()).toBe('');
    expect(component.confirmPassword()).toBe('');
    expect(fixture.nativeElement.textContent).toContain('Your password was changed.');
  });

  it('surfaces an error when the current password is incorrect', async () => {
    loginAsPadme();
    createComponent();
    fixture.detectChanges();
    httpMock.expectOne(ACCOUNT_URL).flush(ACCOUNT_RESPONSE);
    fixture.detectChanges();

    component.currentPassword.set('wrong');
    component.newPassword.set('noblequeen1');
    component.confirmPassword.set('noblequeen1');
    component.updatePassword();
    httpMock.expectOne(`${ACCOUNT_URL}/password`).flush(
      { detail: 'The current password is incorrect.' },
      { status: 400, statusText: 'Bad Request' },
    );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.passwordError()).toBe('The current password is incorrect.');
    expect(fixture.nativeElement.textContent).toContain(
      'The current password is incorrect.',
    );
  });
});
