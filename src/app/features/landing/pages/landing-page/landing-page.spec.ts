import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { LandingPage } from './landing-page';

describe('LandingPage', () => {
  let component: LandingPage;
  let fixture: ComponentFixture<LandingPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LandingPage],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(LandingPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('provides a button that navigates to the Canon timeline', () => {
    fixture.detectChanges();
    const link = fixture.nativeElement.querySelector('a.btn-primary') as HTMLAnchorElement;
    expect(link.textContent).toContain('Explore Canon Timeline');
    expect(link.getAttribute('href')).toBe('/timeline?view=Canon');
  });

  it('provides a button that navigates to the Legends timeline', () => {
    fixture.detectChanges();
    const link = fixture.nativeElement.querySelector('a.btn-secondary') as HTMLAnchorElement;
    expect(link.textContent).toContain('Explore Legends Timeline');
    expect(link.getAttribute('href')).toBe('/timeline?view=Legends');
  });
});
