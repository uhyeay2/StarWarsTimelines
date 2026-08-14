import { TestBed } from '@angular/core/testing';
import { firstValueFrom, lastValueFrom } from 'rxjs';
import { User } from '../models/user';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthService);
  });

  it('logs in a known user with valid credentials', async () => {
    const user = await firstValueFrom(service.login('padme', 'naboo'));
    expect(user).toEqual({
      id: 'user-padme',
      username: 'padme',
      displayName: 'Padmé Amidala',
    });
    expect(service.isLoggedIn()).toBe(true);
  });

  it('is case-insensitive on the username', async () => {
    const user = await firstValueFrom(service.login('LUKE', 'tatooine'));
    expect(user.username).toBe('luke');
  });

  it('rejects invalid credentials', async () => {
    await expect(firstValueFrom(service.login('padme', 'wrong'))).rejects.toThrow(
      'Invalid username or password',
    );
    expect(service.isLoggedIn()).toBe(false);
  });

  it('logs out and clears the current user', async () => {
    await lastValueFrom(service.login('rey', 'jakku'));
    expect(service.isLoggedIn()).toBe(true);
    await lastValueFrom(service.logout());
    expect(service.isLoggedIn()).toBe(false);
  });

  it('exposes the current user through the observable', async () => {
    const users: (User | null)[] = [];
    const subscription = service.currentUser$.subscribe((user) => users.push(user));

    await lastValueFrom(service.login('luke', 'tatooine'));
    await lastValueFrom(service.logout());
    subscription.unsubscribe();

    expect(users).toEqual([
      null,
      expect.objectContaining({ username: 'luke', displayName: 'Luke Skywalker' }),
      null,
    ]);
  });
});
