import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NavDropdown } from './nav-dropdown';

describe('NavDropdown', () => {
  let fixture: ComponentFixture<NavDropdown>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavDropdown],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(NavDropdown);
    fixture.componentRef.setInput('label', 'Timeline');
    fixture.componentRef.setInput('toggleLink', '/timeline');
    fixture.componentRef.setInput('toggleQueryParams', { view: 'Canon' });
    fixture.componentRef.setInput('options', [
      { label: 'Canon', routerLink: '/timeline', queryParams: { view: 'Canon' } },
      { label: 'Legends', routerLink: '/timeline', queryParams: { view: 'Legends' } },
      {
        label: 'Canon & Legends',
        routerLink: '/timeline',
        queryParams: { view: 'Canon & Legends' },
      },
    ]);
    fixture.detectChanges();
  });

  it('renders the toggle label', () => {
    const toggle = fixture.nativeElement.querySelector('.nav-dropdown-toggle');
    expect(toggle?.textContent?.trim()).toBe('Timeline');
  });

  it('renders one menu item per option', () => {
    const items = Array.from(
      fixture.nativeElement.querySelectorAll('a.nav-dropdown-item') as NodeListOf<HTMLAnchorElement>,
    );
    expect(items.map((a) => a.textContent?.trim())).toEqual([
      'Canon',
      'Legends',
      'Canon & Legends',
    ]);
  });

  it('builds option links with their query params', () => {
    const legends = fixture.nativeElement.querySelector(
      'a.nav-dropdown-item:nth-of-type(2)',
    ) as HTMLAnchorElement;
    expect(legends.getAttribute('href')).toContain('/timeline?view=Legends');
  });

  it('deep-links the toggle from the last-viewed filter', () => {
    const toggle = fixture.nativeElement.querySelector(
      '.nav-dropdown-toggle',
    ) as HTMLAnchorElement;
    expect(toggle.getAttribute('href')).toContain('/timeline?view=Canon');
  });
});
