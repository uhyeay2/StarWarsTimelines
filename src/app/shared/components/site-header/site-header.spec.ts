import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SiteHeader } from './site-header';

describe('SiteHeader', () => {
  let fixture: ComponentFixture<SiteHeader>;

  async function create(session: Record<string, string>): Promise<void> {
    sessionStorage.clear();
    for (const [key, value] of Object.entries(session)) {
      sessionStorage.setItem(key, value);
    }
    await TestBed.configureTestingModule({
      imports: [SiteHeader],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(SiteHeader);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  afterEach(() => {
    sessionStorage.clear();
    TestBed.resetTestingModule();
  });

  it('renders the brand and primary nav for visitors', async () => {
    await create({});

    expect(fixture.nativeElement.querySelector('.brand')?.textContent?.trim()).toBe(
      'Star Wars Timelines',
    );
    const dropdowns = [
      ...fixture.nativeElement.querySelectorAll('.site-nav-item'),
    ] as HTMLElement[];

    expect(dropdowns.length).toBe(2);
    expect(dropdowns[0]!.textContent?.trim().startsWith('Timeline')).toBe(true);
    expect(dropdowns[1]!.textContent?.trim().startsWith('Library')).toBe(true);
    expect(fixture.nativeElement.querySelector('.login-link')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.logout-button')).toBeNull();
  });

  it('shows account controls and the catalog dropdown when logged in', async () => {
    await create({
      'starwars-timelines.user': JSON.stringify({
        id: 'u1',
        username: 'luke',
        displayName: 'Luke',
      }),
    });

    expect(fixture.nativeElement.querySelector('.user-name')?.textContent?.trim()).toBe('Luke');
    expect(fixture.nativeElement.querySelector('.logout-button')).toBeTruthy();
    const dropdowns = [
      ...fixture.nativeElement.querySelectorAll('.site-nav-item'),
    ] as HTMLElement[];

    expect(dropdowns.length).toBe(3);
    expect(dropdowns[2]!.textContent?.trim().startsWith('Catalog')).toBe(true);
  });

  it('clears the session and returns to visitor controls on log out', async () => {
    await create({
      'starwars-timelines.user': JSON.stringify({
        id: 'u1',
        username: 'luke',
        displayName: 'Luke',
      }),
    });

    (fixture.nativeElement.querySelector('.logout-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(sessionStorage.getItem('starwars-timelines.user')).toBeNull();
    expect(fixture.nativeElement.querySelector('.login-link')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.logout-button')).toBeNull();
  });

  it('builds timeline dropdown options from the canon views', async () => {
    await create({});

    const options = Array.from(
      fixture.nativeElement.querySelectorAll('.site-nav-item:first-of-type a.nav-dropdown-item') as
        NodeListOf<HTMLAnchorElement>,
    );

    expect(options.length).toBeGreaterThan(1);
    expect(options[0]!.getAttribute('href')).toContain('/timeline?');
  });
});
