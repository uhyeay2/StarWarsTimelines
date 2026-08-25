import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TimelineEvent } from '../../models/timeline-event';
import { TimelineEventCatalog } from './timeline-event-catalog';

const EVENTS_URL = '/api/timeline-events';

/** Minimal timeline-event DTO accepted by the service's validator. */
function eventDto(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 1,
    title: 'The Invasion of Naboo',
    description: 'The Trade Federation blockades and invades Naboo.',
    yearStart: -32,
    yearEnd: -32,
    sequence: 3,
    sourceMaterials: [
      {
        sourceMaterial: {
          id: 100,
          title: 'Star Wars: Episode I - The Phantom Menace',
          medium: 0,
          canonType: 2,
        },
        sourceMaterialUnit: null,
      },
    ],
    characters: [{ id: 7, name: 'Darth Maul' }],
    locations: [{ id: 12, name: 'Naboo' }],
    vehicles: [],
    ...overrides,
  };
}

/** Flushes the initial GETs fired by ngOnInit. */
function flushInitialFetch(httpMock: HttpTestingController): void {
  httpMock
    .expectOne((r) => r.method === 'GET' && r.url.endsWith(EVENTS_URL))
    .flush([eventDto({ id: 2, title: 'Duel on Mustafar', yearStart: -19 }), eventDto()]);
  httpMock
    .expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/characters'))
    .flush([{ id: 7, name: 'Darth Maul' }]);
  httpMock
    .expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/locations'))
    .flush([{ id: 12, name: 'Naboo' }]);
  httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/vehicles')).flush([]);
  httpMock
    .expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/source-materials'))
    .flush([{ id: 100, title: 'A New Hope', medium: 0, canonType: 0 }]);
}

/** Flushes the unit-list GET fired for one material's cache. */
function flushUnitFetch(httpMock: HttpTestingController, materialId = 100): void {
  httpMock
    .expectOne(
      (r) => r.method === 'GET' && r.url.endsWith(`/api/source-materials/${materialId}/units`),
    )
    .flush([]);
}

describe('TimelineEventCatalog', () => {
  let component: TimelineEventCatalog;
  let fixture: ComponentFixture<TimelineEventCatalog>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [TimelineEventCatalog],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(TimelineEventCatalog);
    fixture.componentRef.setInput('isAdmin', true);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    flushInitialFetch(httpMock);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('renders events sorted chronologically', () => {
    const names = Array.from(
      fixture.nativeElement.querySelectorAll('.event-name') as NodeListOf<Element>,
    ).map((n) => n.textContent?.trim());
    expect(names).toEqual(['The Invasion of Naboo', 'Duel on Mustafar']);
    expect(fixture.nativeElement.textContent).toContain('32 BBY');
  });

  it('filters events by search term', () => {
    component.searchTerm.set('mustafar');
    fixture.detectChanges();

    expect(component.filteredItems()).toHaveLength(1);
    expect(fixture.nativeElement.textContent).not.toContain('The Invasion of Naboo');
  });

  it('leads each row with its year label before the title', () => {
    const headings = Array.from(
      fixture.nativeElement.querySelectorAll('.event-item-heading') as NodeListOf<Element>,
    );
    expect(headings.length).toBeGreaterThan(0);
    for (const heading of headings) {
      const first = heading.querySelector('.event-years')!;
      expect(first).toBeTruthy();
    }
    expect(headings[0]!.querySelector('.event-years')!.textContent?.trim()).toMatch(/BBY|ABY/);
  });

  it('toggles an inline details block per row', () => {
    expect(fixture.nativeElement.querySelector('.event-details')).toBeNull();

    (fixture.nativeElement.querySelector('.event-details-toggle') as HTMLButtonElement).click();
    flushUnitFetch(httpMock);
    fixture.detectChanges();
    const details = fixture.nativeElement.querySelector('.event-details')!;
    expect(details).toBeTruthy();
    expect(details.textContent).toContain('The Trade Federation blockades');
    expect(details.textContent).toContain('Star Wars: Episode I - The Phantom Menace');
    expect(details.textContent).toContain('Darth Maul');
    expect(details.textContent).toContain('Naboo');

    (fixture.nativeElement.querySelector('.event-details-toggle') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.event-details')).toBeNull();
  });

  it('expands multiple rows independently', () => {
    const toggles = fixture.nativeElement.querySelectorAll(
      '.event-details-toggle',
    ) as NodeListOf<HTMLButtonElement>;
    expect(toggles.length).toBe(2);

    toggles[0]!.click();
    toggles[1]!.click();
    // Both rows reference the same material, so only one unit fetch fires.
    flushUnitFetch(httpMock);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.event-details').length).toBe(2);

    toggles[0]!.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.event-details').length).toBe(1);
  });

  it('does not show a source count on collapsed rows', () => {
    const rows = fixture.nativeElement.querySelectorAll('.event-item-text') as NodeListOf<Element>;
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.textContent).not.toMatch(/\bsources?\b/);
    }
  });

  it('opens the add dialog from the header button and cancels it', () => {
    (fixture.nativeElement.querySelector('.catalog-add-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    // The dialog-open effect prefetches every material's units.
    flushUnitFetch(httpMock);

    expect(component.dialogOpen()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Add event');

    (fixture.nativeElement.querySelector('.admin-popup-backdrop') as HTMLElement).click();
    fixture.detectChanges();
    expect(component.dialogOpen()).toBe(false);
  });

  it('rejects a blank title without calling the API', () => {
    component.openAdd();
    component.submitDialog();

    expect(component.formError()).toBe('A title is required.');
    httpMock.expectNone((r) => r.method === 'POST');
  });

  it('rejects an event with no source materials without calling the API', () => {
    component.openAdd();
    component.title.set('Untitled event');
    component.yearStart.set(-5);
    component.submitDialog();

    expect(component.formError()).toBe('Link at least one source material.');
    httpMock.expectNone((r) => r.method === 'POST');
  });

  it('creates an event through the dialog and refreshes the list', () => {
    component.openAdd();
    component.title.set('Order 66');
    component.description.set('The clones turn on the Jedi.');
    component.yearStart.set(-19);
    component.sourceSelection.set(['100']);
    component.characterSelection.set(['7']);
    fixture.detectChanges();
    flushUnitFetch(httpMock);
    component.submitDialog();

    const post = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith(EVENTS_URL));
    expect(post.request.body).toEqual({
      title: 'Order 66',
      description: 'The clones turn on the Jedi.',
      yearStart: -19,
      yearEnd: -19,
      sequence: 0,
      sourceMaterials: [{ sourceMaterialId: 100, sourceMaterialUnitId: null }],
      characterIds: [7],
      locationIds: [],
      vehicleIds: [],
    });
    post.flush(eventDto({ id: 3, title: 'Order 66', yearStart: -19 }));

    // The service auto-refreshes the list after a mutation.
    httpMock
      .expectOne((r) => r.method === 'GET' && r.url.endsWith(EVENTS_URL))
      .flush([eventDto(), eventDto({ id: 3, title: 'Order 66', yearStart: -19 })]);
    fixture.detectChanges();

    expect(component.dialogOpen()).toBe(false);
    expect(component.title()).toBe('');
    expect(fixture.nativeElement.textContent).toContain('Order 66');
  });

  it('prefills the dialog when editing and sends the full payload on save', () => {
    const item = component.filteredItems().find((e) => e.id === 1)!;
    component.beginEdit(item);
    fixture.detectChanges();
    flushUnitFetch(httpMock);

    expect(component.editingId()).toBe(1);
    expect(component.title()).toBe('The Invasion of Naboo');
    expect(component.sourceSelection()).toEqual(['100']);
    expect(component.characterSelection()).toEqual(['7']);
    expect(component.locationSelection()).toEqual(['12']);

    component.title.set('The Invasion of Naboo (edited)');
    component.submitDialog();

    const put = httpMock.expectOne((r) => r.method === 'PUT' && r.url.endsWith(`${EVENTS_URL}/1`));
    expect(put.request.body).toMatchObject({ title: 'The Invasion of Naboo (edited)' });
    put.flush(eventDto({ title: 'The Invasion of Naboo (edited)' }));

    httpMock
      .expectOne((r) => r.method === 'GET' && r.url.endsWith(EVENTS_URL))
      .flush([eventDto({ title: 'The Invasion of Naboo (edited)' })]);
    fixture.detectChanges();

    expect(component.dialogOpen()).toBe(false);
    expect(component.editingId()).toBeNull();
  });

  it('round-trips a pinned episode through edit without losing granularity', () => {
    const item: TimelineEvent = {
      id: 4,
      canon: ['Canon'],
      title: 'Spark of Rebellion',
      description: '',
      sources: [
        {
          title: 'Star Wars: Rebels',
          medium: 'Animated Show',
          canon: ['Canon'],
          sourceId: 100,
          unit: {
            id: 71,
            unitType: 'Episode',
            number: 1,
            title: 'Spark of Rebellion',
            parentUnitId: 53,
          },
        },
      ],
      locations: [],
      characters: [],
      vehicles: [],
      yearStart: -5,
      yearEnd: -5,
      sequence: 1,
    };

    component.beginEdit(item);
    fixture.detectChanges();
    flushUnitFetch(httpMock);

    // Exact tree value for the nested episode — not the season, not whole.
    expect(component.sourceSelection()).toEqual(['100:53:71']);

    component.submitDialog();
    const put = httpMock.expectOne((r) => r.method === 'PUT' && r.url.endsWith(`${EVENTS_URL}/4`));
    expect(put.request.body).toMatchObject({
      sourceMaterials: [{ sourceMaterialId: 100, sourceMaterialUnitId: 71 }],
    });
    put.flush(eventDto({ id: 4, title: 'Spark of Rebellion' }));

    httpMock
      .expectOne((r) => r.method === 'GET' && r.url.endsWith(EVENTS_URL))
      .flush([eventDto({ id: 2, title: 'Duel on Mustafar', yearStart: -19 }), eventDto()]);
    fixture.detectChanges();

    expect(component.dialogOpen()).toBe(false);
  });

  it('deletes an event after inline confirmation', () => {
    const item = component.filteredItems().find((e) => e.id === 1)!;
    component.requestDelete(item);
    fixture.detectChanges();
    expect(component.confirmDeleteId()).toBe(1);

    component.confirmDelete();

    httpMock
      .expectOne((r) => r.method === 'DELETE' && r.url.endsWith(`${EVENTS_URL}/1`))
      .flush(null);
    httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith(EVENTS_URL)).flush([]);
    fixture.detectChanges();

    expect(component.confirmDeleteId()).toBeNull();
    expect(component.items()).toEqual([]);
  });

  it('hides admin controls for non-admin users', () => {
    fixture.componentRef.setInput('isAdmin', false);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.catalog-add-button')).toBeNull();
    expect(fixture.nativeElement.querySelector('.event-actions .btn')).toBeNull();
    // The details toggle remains available to read-only users.
    expect(fixture.nativeElement.querySelector('.event-details-toggle')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('The Invasion of Naboo');
  });
});
