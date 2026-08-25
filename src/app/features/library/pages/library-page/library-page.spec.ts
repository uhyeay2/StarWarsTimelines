import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { User } from '../../../../shared/models/user';
import { AuthService } from '../../../auth/services/auth.service';
import { LibraryPage } from './library-page';

const USER: User = { id: 'user-padme', username: 'padme', displayName: 'Padmé Amidala', email: 'padme@example.com', emailVerified: true, role: 'Standard' };

async function setup(currentUser: User | null): Promise<ComponentFixture<LibraryPage>> {
  await TestBed.configureTestingModule({
    imports: [LibraryPage],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { currentUser: signal(currentUser) } },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(LibraryPage);
  fixture.detectChanges();
  return fixture;
}

describe('LibraryPage', () => {
  it('should create', async () => {
    expect(await setup(USER)).toBeTruthy();
  });

  it('shows a login prompt when logged out', async () => {
    const fixture = await setup(null);
    expect(fixture.nativeElement.querySelector('.login-prompt')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('.hub-card').length).toBe(0);
  });

  it('shows hub links for tracked events, wish list, and known timeline', async () => {
    const fixture = await setup(USER);
    const cards = fixture.nativeElement.querySelectorAll('.hub-card');
    expect(cards.length).toBe(3);
    expect(fixture.nativeElement.textContent).toContain('My Tracked Events');
    expect(fixture.nativeElement.textContent).toContain('My Wish List');
    expect(fixture.nativeElement.textContent).toContain('Known Timeline');
    expect((cards[0] as HTMLAnchorElement).getAttribute('href')).toBe('/library/tracked');
    expect((cards[1] as HTMLAnchorElement).getAttribute('href')).toBe('/library/wish-list');
    expect((cards[2] as HTMLAnchorElement).getAttribute('href')).toBe('/library/timeline');
  });
});
