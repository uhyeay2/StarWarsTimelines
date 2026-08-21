import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CatalogPage } from './catalog-page';

describe('CatalogPage', () => {
  let component: CatalogPage;
  let fixture: ComponentFixture<CatalogPage>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [CatalogPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(CatalogPage);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    const initial = httpMock.expectOne(
      (r) => r.method === 'GET' && r.url.endsWith('/api/source-materials'),
    );
    initial.flush([]);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('renders the page heading', () => {
    expect(fixture.nativeElement.textContent).toContain('Catalog');
    expect(fixture.nativeElement.textContent).toContain('Browse the timeline catalog');
  });

  it('renders all four tabs', () => {
    const tabs = fixture.nativeElement.querySelectorAll('.catalog-tab') as HTMLButtonElement[];
    expect(tabs.length).toBe(4);
    expect(Array.from(tabs).map((t) => t.textContent?.trim())).toEqual([
      'Source materials',
      'Characters',
      'Vehicles',
      'Locations',
    ]);
  });

  it('defaults to the source materials tab', () => {
    expect(component.activeTab()).toBe('sources');
    expect(fixture.nativeElement.querySelector('.catalog-tab--active')?.textContent?.trim()).toBe(
      'Source materials',
    );
  });

  it('switches to the vehicles tab on click', () => {
    const tabs = fixture.nativeElement.querySelectorAll('.catalog-tab') as HTMLButtonElement[];
    tabs[2].click();
    fixture.detectChanges();

    const vehiclesRequest = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/vehicles'));
    vehiclesRequest.flush([]);
    fixture.detectChanges();

    expect(component.activeTab()).toBe('vehicles');
    expect(fixture.nativeElement.querySelector('.catalog-tab--active')?.textContent?.trim()).toBe(
      'Vehicles',
    );
  });
});
