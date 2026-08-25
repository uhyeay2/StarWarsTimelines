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

  it('renders all six tabs', () => {
    const tabs = fixture.nativeElement.querySelectorAll('.catalog-tab') as HTMLButtonElement[];
    expect(tabs.length).toBe(6);
    expect(Array.from(tabs).map((t) => t.textContent?.trim())).toEqual([
      'Source materials',
      'Timeline events',
      'Characters',
      'Vehicles',
      'Locations',
      'Species',
    ]);
  });

  /** Clicks the catalog tab with the given label. */
  function clickTab(label: string): void {
    const tabs = Array.from(
      fixture.nativeElement.querySelectorAll('.catalog-tab') as NodeListOf<HTMLButtonElement>,
    );
    const tab = tabs.find((t) => t.textContent?.trim() === label);
    if (!tab) {
      throw new Error(`Tab not found: ${label}`);
    }
    tab.click();
    fixture.detectChanges();
  }

  it('defaults to the source materials tab', () => {
    expect(component.activeTab()).toBe('sources');
    expect(fixture.nativeElement.querySelector('.catalog-tab--active')?.textContent?.trim()).toBe(
      'Source materials',
    );
  });

  it('switches to the vehicles tab on click', () => {
    clickTab('Vehicles');

    const vehiclesRequest = httpMock.expectOne(
      (r) => r.method === 'GET' && r.url.endsWith('/api/vehicles'),
    );
    vehiclesRequest.flush([]);
    fixture.detectChanges();

    expect(component.activeTab()).toBe('vehicles');
    expect(fixture.nativeElement.querySelector('.catalog-tab--active')?.textContent?.trim()).toBe(
      'Vehicles',
    );
  });

  it('switches to the species tab on click', () => {
    clickTab('Species');

    const speciesRequest = httpMock.expectOne(
      (r) => r.method === 'GET' && r.url.endsWith('/api/species'),
    );
    speciesRequest.flush([]);
    const locationsRequest = httpMock.expectOne(
      (r) => r.method === 'GET' && r.url.endsWith('/api/locations'),
    );
    locationsRequest.flush([]);
    fixture.detectChanges();

    expect(component.activeTab()).toBe('species');
    expect(fixture.nativeElement.querySelector('.catalog-tab--active')?.textContent?.trim()).toBe(
      'Species',
    );
  });
});
