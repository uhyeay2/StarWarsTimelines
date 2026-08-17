import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminPage } from './admin-page';

describe('AdminPage', () => {
  let component: AdminPage;
  let fixture: ComponentFixture<AdminPage>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [AdminPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminPage);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    const initial = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/characters'));
    initial.flush([]);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('renders the page heading', () => {
    expect(fixture.nativeElement.textContent).toContain('Admin');
    expect(fixture.nativeElement.textContent).toContain('Manage the timeline catalog');
  });

  it('renders all four tabs', () => {
    const tabs = fixture.nativeElement.querySelectorAll('.admin-tab') as HTMLButtonElement[];
    expect(tabs.length).toBe(4);
    expect(Array.from(tabs).map((t) => t.textContent?.trim())).toEqual([
      'Characters',
      'Vehicles',
      'Locations',
      'Source materials',
    ]);
  });

  it('defaults to the characters tab', () => {
    expect(component.activeTab()).toBe('characters');
    expect(fixture.nativeElement.querySelector('.admin-tab--active')?.textContent?.trim()).toBe(
      'Characters',
    );
  });

  it('switches to the vehicles tab on click', () => {
    const tabs = fixture.nativeElement.querySelectorAll('.admin-tab') as HTMLButtonElement[];
    tabs[1].click();
    fixture.detectChanges();

    const vehiclesRequest = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/vehicles'));
    vehiclesRequest.flush([]);
    fixture.detectChanges();

    expect(component.activeTab()).toBe('vehicles');
    expect(fixture.nativeElement.querySelector('.admin-tab--active')?.textContent?.trim()).toBe(
      'Vehicles',
    );
  });
});
