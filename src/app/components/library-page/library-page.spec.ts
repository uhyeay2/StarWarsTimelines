import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { User } from '../../models/user';
import { AuthService } from '../../services/auth.service';
import { LibraryPage } from './library-page';

const USER: User = { id: 'user-padme', username: 'padme', displayName: 'Padmé Amidala' };

async function setup(currentUser: User | null): Promise<ComponentFixture<LibraryPage>> {
  await TestBed.configureTestingModule({
    imports: [LibraryPage],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { currentUser$: of(currentUser) } },
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

  it('shows hub links for the tracked events and known timeline', async () => {
    const fixture = await setup(USER);
    const cards = fixture.nativeElement.querySelectorAll('.hub-card');
    expect(cards.length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('My Tracked Events');
    expect(fixture.nativeElement.textContent).toContain('Known Timeline');
    expect((cards[0] as HTMLAnchorElement).getAttribute('href')).toBe('/library/tracked');
    expect((cards[1] as HTMLAnchorElement).getAttribute('href')).toBe('/library/timeline');
  });
});
