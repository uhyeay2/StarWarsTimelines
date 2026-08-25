import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AccountService } from './account.service';

const ACCOUNT_URL = `${environment.apiBaseUrl}/api/users`;

const PADME_ID = '22222222-0000-0000-0000-000000000000';
const PADME_ACCOUNT = {
  id: PADME_ID,
  username: 'padme',
  displayName: 'Padmé Amidala',
  email: 'padme@example.com',
  emailVerified: true,
  role: 0,
};

describe('AccountService', () => {
  let service: AccountService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AccountService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches the account details and stores the user', async () => {
    const fetchPromise = firstValueFrom(service.getAccount(PADME_ID));
    const request = httpMock.expectOne(`${ACCOUNT_URL}/${PADME_ID}`);
    expect(request.request.method).toBe('GET');
    request.flush(PADME_ACCOUNT);

    const account = await fetchPromise;
    expect(account).toEqual({
      id: PADME_ID,
      username: 'padme',
      displayName: 'Padmé Amidala',
      email: 'padme@example.com',
      emailVerified: true,
      role: 'Standard',
    });
    expect(JSON.parse(sessionStorage.getItem('starwars-timelines.user')!)).toEqual(
      expect.objectContaining({ email: 'padme@example.com', emailVerified: true }),
    );
  });

  it('surfaces a server error when the account cannot be loaded', async () => {
    const fetchPromise = firstValueFrom(service.getAccount('unknown-id'));
    httpMock
      .expectOne(`${ACCOUNT_URL}/unknown-id`)
      .flush(
        { detail: 'No user with the requested identifier was found.' },
        { status: 404, statusText: 'Not Found' },
      );

    await expect(fetchPromise).rejects.toThrow('No user with the requested identifier was found.');
  });

  it('updates the display name and stores the updated user', async () => {
    const updatePromise = firstValueFrom(service.updateDisplayName(PADME_ID, 'Queen Amidala'));
    const request = httpMock.expectOne(`${ACCOUNT_URL}/${PADME_ID}/display-name`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ displayName: 'Queen Amidala' });
    request.flush({ ...PADME_ACCOUNT, displayName: 'Queen Amidala' });

    const account = await updatePromise;
    expect(account.displayName).toBe('Queen Amidala');
    expect(JSON.parse(sessionStorage.getItem('starwars-timelines.user')!).displayName).toBe(
      'Queen Amidala',
    );
  });

  it('updates the email address and reports the unverified state', async () => {
    const updatePromise = firstValueFrom(service.updateEmail(PADME_ID, 'queen@example.com'));
    const request = httpMock.expectOne(`${ACCOUNT_URL}/${PADME_ID}/email`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ email: 'queen@example.com' });
    request.flush({ ...PADME_ACCOUNT, email: 'queen@example.com', emailVerified: false });

    const account = await updatePromise;
    expect(account.email).toBe('queen@example.com');
    expect(account.emailVerified).toBe(false);
    expect(JSON.parse(sessionStorage.getItem('starwars-timelines.user')!)).toEqual(
      expect.objectContaining({ email: 'queen@example.com', emailVerified: false }),
    );
  });

  it('surfaces a server error when the email is already in use', async () => {
    const updatePromise = firstValueFrom(service.updateEmail(PADME_ID, 'taken@example.com'));
    httpMock
      .expectOne(`${ACCOUNT_URL}/${PADME_ID}/email`)
      .flush(
        { detail: 'A user with this email address is already registered.' },
        { status: 400, statusText: 'Bad Request' },
      );

    await expect(updatePromise).rejects.toThrow(
      'A user with this email address is already registered.',
    );
  });

  it('changes the password with the current and new password', async () => {
    const updatePromise = firstValueFrom(
      service.updatePassword(PADME_ID, 'padme123', 'noblequeen1'),
    );
    const request = httpMock.expectOne(`${ACCOUNT_URL}/${PADME_ID}/password`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      currentPassword: 'padme123',
      newPassword: 'noblequeen1',
    });
    request.flush(null);

    await expect(updatePromise).resolves.toBeNull();
  });

  it('surfaces a server error when the current password is incorrect', async () => {
    const updatePromise = firstValueFrom(service.updatePassword(PADME_ID, 'wrong', 'noblequeen1'));
    httpMock
      .expectOne(`${ACCOUNT_URL}/${PADME_ID}/password`)
      .flush(
        { detail: 'The current password is incorrect.' },
        { status: 400, statusText: 'Bad Request' },
      );

    await expect(updatePromise).rejects.toThrow('The current password is incorrect.');
  });
});
