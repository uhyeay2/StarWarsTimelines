import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { environment } from '../../../../../environments/environment';
import { User } from '../../../../shared/models/user';
import { AuthService } from '../../../auth/services/auth.service';
import { LibraryItemDto } from '../../../library/services/library.dto';
import { TimelineEventItem, ToggleFacetEvent } from './timeline-event-item';

const API_BASE = `${environment.apiBaseUrl}/api`;

describe('TimelineEventItem', () => {
  let component: TimelineEventItem;
  let fixture: ComponentFixture<TimelineEventItem>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TimelineEventItem],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(TimelineEventItem);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('event', {
      id: 1,
      canon: ['Canon', 'Legends'],
      title: 'Test Event',
      description: 'A test event description.',
      sources: [{ title: 'Test Source', medium: 'Book', canon: ['Canon', 'Legends'] }],
      locations: ['Tatooine'],
      characters: ['Luke Skywalker'],
      vehicles: ['Millennium Falcon'],
      yearStart: 0,
      yearEnd: 0,
      sequence: 1,
    });
    fixture.componentRef.setInput('sourceChips', [
      { label: 'Book', values: ['book-leaf'], medium: true },
      { label: 'Test Source', values: ['test-source'] },
    ]);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('hides the description and facet details by default', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.event-title')?.textContent).toContain('Test Event');
    expect(compiled.querySelector('.event-description')).toBeNull();
    expect(compiled.querySelector('.event-detail')).toBeNull();
    expect(compiled.querySelectorAll('.event-detail button.chip').length).toBe(0);
    const toggle = compiled.querySelector('.details-toggle') as HTMLElement;
    expect(toggle).toBeTruthy();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('reveals and hides the details via the toggle button', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const toggle = compiled.querySelector('.details-toggle') as HTMLElement;

    toggle.click();
    fixture.detectChanges();
    expect(compiled.querySelector('.event-description')).toBeTruthy();
    expect(compiled.querySelectorAll('.event-detail').length).toBe(3);
    expect(compiled.querySelectorAll('.event-detail button.chip').length).toBe(3);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.textContent).toContain('Hide details');

    toggle.click();
    fixture.detectChanges();
    expect(compiled.querySelector('.event-description')).toBeNull();
    expect(compiled.querySelectorAll('.event-detail button.chip').length).toBe(0);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('links the toggle button to the details region', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const toggle = compiled.querySelector('.details-toggle') as HTMLElement;
    const controls = toggle.getAttribute('aria-controls');
    expect(controls).toBeTruthy();

    toggle.click();
    fixture.detectChanges();
    const details = compiled.querySelector('.event-details') as HTMLElement;
    expect(details.id).toBe(controls);
  });

  it('renders the event details', () => {
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.details-toggle') as HTMLElement).click();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.event-title')?.textContent).toContain('Test Event');
    expect(compiled.querySelector('.event-description')?.textContent).toContain(
      'A test event description.',
    );
    expect(compiled.querySelector('.event-date')?.textContent).toContain('0 BBY');
    expect(compiled.querySelector('.event-source')?.textContent).toContain('Test Source');
    expect(compiled.querySelectorAll('.canon-badge').length).toBe(2);
    expect(compiled.textContent).toContain('Tatooine');
    expect(compiled.textContent).toContain('Luke Skywalker');
    expect(compiled.textContent).toContain('Millennium Falcon');
  });

  it('renders location, character and vehicle chips as toggleable buttons', () => {
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.details-toggle') as HTMLElement).click();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const chips = [...compiled.querySelectorAll('.event-detail button.chip')];
    expect(chips.length).toBe(3);
    expect(chips.every((chip) => chip.getAttribute('aria-pressed') === 'false')).toBe(true);
  });

  it('highlights chips that are selected in the filters', () => {
    fixture.componentRef.setInput('selectedLocations', ['Tatooine']);
    fixture.componentRef.setInput('selectedCharacters', ['Luke Skywalker']);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.details-toggle') as HTMLElement).click();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const chips = [...compiled.querySelectorAll('button.chip')];
    const tatooine = chips.find((chip) => chip.textContent?.trim() === 'Tatooine') as HTMLElement;
    const luke = chips.find((chip) => chip.textContent?.trim() === 'Luke Skywalker') as HTMLElement;
    const falcon = chips.find(
      (chip) => chip.textContent?.trim() === 'Millennium Falcon',
    ) as HTMLElement;
    expect(tatooine.classList.contains('chip--selected')).toBe(true);
    expect(tatooine.getAttribute('aria-pressed')).toBe('true');
    expect(luke.classList.contains('chip--selected')).toBe(true);
    expect(falcon.classList.contains('chip--selected')).toBe(false);
  });

  it('emits a toggle event when a chip is clicked', () => {
    const emissions: ToggleFacetEvent[] = [];
    component.toggleFacet.subscribe((event) => emissions.push(event));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.details-toggle') as HTMLElement).click();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const falcon = [...compiled.querySelectorAll('button.chip')].find(
      (chip) => chip.textContent?.trim() === 'Millennium Falcon',
    ) as HTMLElement;
    falcon.click();
    expect(emissions).toEqual([{ key: 'vehicles', values: ['Millennium Falcon'] }]);
  });

  it('renders the medium and source chips as toggleable buttons', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const medium = compiled.querySelector('.source-chip--medium') as HTMLElement;
    const source = [...compiled.querySelectorAll('.source-chip--source')].find(
      (chip) => chip.textContent?.trim() === 'Test Source',
    ) as HTMLElement;
    expect(medium).toBeTruthy();
    expect(medium.textContent?.trim()).toBe('Book');
    expect(medium.getAttribute('aria-pressed')).toBe('false');
    expect(source).toBeTruthy();
    expect(source.textContent?.trim()).toBe('Test Source');
    expect(source.getAttribute('aria-pressed')).toBe('false');
  });

  it('emits a source toggle with every medium leaf when the medium chip is clicked', () => {
    const emissions: ToggleFacetEvent[] = [];
    component.toggleFacet.subscribe((event) => emissions.push(event));
    fixture.detectChanges();
    const medium = fixture.nativeElement.querySelector('.source-chip--medium') as HTMLElement;
    medium.click();
    expect(emissions).toEqual([{ key: 'sources', values: ['book-leaf'] }]);
  });

  it('emits a source toggle event when a source chip is clicked', () => {
    const emissions: ToggleFacetEvent[] = [];
    component.toggleFacet.subscribe((event) => emissions.push(event));
    fixture.detectChanges();
    const source = [...fixture.nativeElement.querySelectorAll('.source-chip--source')].find(
      (chip) => chip.textContent?.trim() === 'Test Source',
    ) as HTMLElement;
    source.click();
    expect(emissions).toEqual([{ key: 'sources', values: ['test-source'] }]);
  });

  it('highlights the medium and source chips when their values are selected', () => {
    fixture.componentRef.setInput('selectedSources', ['book-leaf', 'test-source']);
    fixture.detectChanges();
    const medium = fixture.nativeElement.querySelector('.source-chip--medium') as HTMLElement;
    const source = [...fixture.nativeElement.querySelectorAll('.source-chip--source')].find(
      (chip) => chip.textContent?.trim() === 'Test Source',
    ) as HTMLElement;
    expect(medium.classList.contains('chip--selected')).toBe(true);
    expect(medium.getAttribute('aria-pressed')).toBe('true');
    expect(source.classList.contains('chip--selected')).toBe(true);
    expect(source.getAttribute('aria-pressed')).toBe('true');
  });

  it('only highlights a source chip when all of its values are selected', () => {
    fixture.componentRef.setInput('selectedSources', ['material-tcw:2']);
    fixture.componentRef.setInput('sourceChips', [
      { label: 'The Clone Wars', values: ['material-tcw:2', 'material-tcw:7'] },
    ]);
    fixture.detectChanges();
    const source = fixture.nativeElement.querySelector('.source-chip--source') as HTMLElement;
    expect(source.classList.contains('chip--selected')).toBe(false);
    expect(source.getAttribute('aria-pressed')).toBe('false');
  });

  it('emits all season leaves when the whole show chip is clicked', () => {
    const emissions: ToggleFacetEvent[] = [];
    component.toggleFacet.subscribe((event) => emissions.push(event));
    fixture.componentRef.setInput('sourceChips', [
      { label: 'The Clone Wars', values: ['material-tcw:2', 'material-tcw:7'] },
      { label: 'Season 2', values: ['material-tcw:2'] },
    ]);
    fixture.detectChanges();
    const sources = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('.source-chip--source'),
    ] as HTMLElement[];
    sources[0]!.click();
    expect(emissions).toEqual([{ key: 'sources', values: ['material-tcw:2', 'material-tcw:7'] }]);
  });

  it('emits a single season key when a season chip is clicked', () => {
    const emissions: ToggleFacetEvent[] = [];
    component.toggleFacet.subscribe((event) => emissions.push(event));
    fixture.componentRef.setInput('sourceChips', [
      { label: 'The Clone Wars', values: ['material-tcw:2', 'material-tcw:7'] },
      { label: 'Season 2', values: ['material-tcw:2'] },
    ]);
    fixture.detectChanges();
    const sources = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('.source-chip--source'),
    ] as HTMLElement[];
    sources[1]!.click();
    expect(emissions).toEqual([{ key: 'sources', values: ['material-tcw:2'] }]);
  });

  it('emits the chapter key when a book chapter chip is clicked', () => {
    const emissions: ToggleFacetEvent[] = [];
    component.toggleFacet.subscribe((event) => emissions.push(event));
    fixture.componentRef.setInput('event', {
      id: 1,
      canon: ['Canon'],
      title: 'Test Event',
      description: 'A test event description.',
      sources: [
        {
          title: 'Shatterpoint',
          medium: 'Book',
          canon: ['Canon'],
          sourceId: 'material-shatterpoint',
          unit: { unitType: 'Chapter', number: 2 },
        },
      ],
      locations: [],
      characters: [],
      vehicles: [],
      yearStart: -19,
      yearEnd: -19,
      sequence: 1,
    });
    fixture.componentRef.setInput('sourceChips', [
      {
        label: 'Shatterpoint',
        values: ['material-shatterpoint:chapter-1', 'material-shatterpoint:chapter-2'],
      },
      { label: 'Chapter 2', values: ['material-shatterpoint:chapter-2'] },
    ]);
    fixture.detectChanges();
    const sources = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('.source-chip--source'),
    ] as HTMLElement[];
    sources[1]!.click();
    expect(emissions).toEqual([{ key: 'sources', values: ['material-shatterpoint:chapter-2'] }]);
  });

  it('renders the source unit detail next to the chips when the event has a unit', () => {
    fixture.componentRef.setInput('event', {
      id: 1,
      canon: ['Canon', 'Legends'],
      title: 'Test Event',
      description: 'A test event description.',
      sources: [
        {
          title: 'The Clone Wars',
          medium: 'Animated Show',
          canon: ['Canon', 'Legends'],
          sourceId: 'material-tcw',
          unit: {
            unitType: 'Episode',
            parentUnitId: 107,
            number: 9,
            title: 'The Siege of Mandalore',
          },
        },
      ],
      locations: [],
      characters: [],
      vehicles: [],
      yearStart: -19,
      yearEnd: -19,
      sequence: 1,
    });
    fixture.componentRef.setInput('sourceChips', [
      { label: 'The Clone Wars', values: ['material-tcw:7'] },
      { label: 'Season 7', values: ['material-tcw:7'] },
    ]);
    fixture.detectChanges();
    const source = fixture.nativeElement.querySelector('.event-source') as HTMLElement;
    const unit = fixture.nativeElement.querySelector('.event-source-unit') as HTMLElement;
    expect(unit.textContent?.trim()).toBe('Episode 9: The Siege of Mandalore');
    expect(source.textContent).toContain('Season 7');
  });

  it('renders a date range spanning eras when the years differ', () => {
    fixture.componentRef.setInput('event', {
      id: 'range-event',
      canon: ['Canon'],
      title: 'Ranged Event',
      description: '',
      sources: [{ title: 'Test Source', medium: 'Book', canon: ['Canon'] }],
      locations: [],
      characters: [],
      vehicles: [],
      yearStart: -1,
      yearEnd: 5,
      sequence: 1,
    });
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.event-date')?.textContent?.trim()).toBe('1 BBY – 5 ABY');
  });

  it('renders unit details for every depicting source', () => {
    fixture.componentRef.setInput('event', {
      id: 'dual-source-event',
      canon: ['Canon', 'Legends'],
      title: 'Dual Source Event',
      description: '',
      sources: [
        {
          title: 'The Clone Wars',
          medium: 'Animated Show',
          canon: ['Canon'],
          sourceId: 'material-tcw',
          unit: {
            unitType: 'Episode',
            parentUnitId: 107,
            number: 9,
            title: 'The Siege of Mandalore',
          },
        },
        {
          title: 'Darth Vader (2017)',
          medium: 'Comic',
          canon: ['Legends'],
          sourceId: 'material-dv',
          unit: { unitType: 'Issue', parentUnitId: null, number: 6 },
        },
      ],
      locations: [],
      characters: [],
      vehicles: [],
      yearStart: -19,
      yearEnd: -19,
      sequence: 1,
    });
    fixture.detectChanges();
    const units = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('.event-source-unit'),
    ] as HTMLElement[];
    expect(units.map((unit) => unit.textContent?.trim())).toEqual([
      'Episode 9: The Siege of Mandalore',
      'Issue 6',
    ]);
  });

  it('omits the unit detail for a chapter unit without a title', () => {
    fixture.componentRef.setInput('event', {
      id: 1,
      canon: ['Canon'],
      title: 'Test Event',
      description: 'A test event description.',
      sources: [
        {
          title: 'Shatterpoint',
          medium: 'Book',
          canon: ['Canon'],
          sourceId: 'material-shatterpoint',
          unit: { unitType: 'Chapter', number: 1 },
        },
      ],
      locations: [],
      characters: [],
      vehicles: [],
      yearStart: -19,
      yearEnd: -19,
      sequence: 1,
    });
    fixture.componentRef.setInput('sourceChips', [
      { label: 'Shatterpoint', values: ['material-shatterpoint:chapter-1'] },
      { label: 'Chapter 1', values: ['material-shatterpoint:chapter-1'] },
    ]);
    fixture.detectChanges();
    const hiddenUnit = fixture.nativeElement.querySelector('.event-source-unit');
    expect(hiddenUnit).not.toBeNull();
    expect((hiddenUnit as HTMLElement).hidden).toBe(true);
  });

  it('renders a nested collection book as a chip instead of a plain-text detail', () => {
    fixture.componentRef.setInput('event', {
      id: 20,
      canon: ['Canon'],
      title: 'Test Event',
      description: 'A test event description.',
      sources: [
        {
          title: 'Thrawn Ascendancy Trilogy',
          medium: 'Book',
          canon: ['Canon'],
          sourceId: 23,
          unit: {
            id: 74,
            unitType: 'Book',
            parentUnitId: 73,
            number: 1,
            title: 'Chaos Rising',
          },
        },
      ],
      locations: [],
      characters: [],
      vehicles: [],
      yearStart: -3,
      yearEnd: -3,
      sequence: 1,
    });
    fixture.componentRef.setInput('sourceChips', [
      { label: 'Thrawn Ascendancy Trilogy', values: ['23:u74', '23:u78'] },
      { label: 'Book 1: Chaos Rising', values: ['23:u74'] },
    ]);
    fixture.detectChanges();
    const nestedUnit = fixture.nativeElement.querySelector('.event-source-unit');
    expect(nestedUnit).not.toBeNull();
    expect((nestedUnit as HTMLElement).hidden).toBe(true);
    const bookChip = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('.source-chip--source'),
    ].find((chip) => chip.textContent?.trim() === 'Book 1: Chaos Rising') as HTMLElement;
    expect(bookChip).toBeTruthy();

    const emissions: ToggleFacetEvent[] = [];
    component.toggleFacet.subscribe((event) => emissions.push(event));
    bookChip.click();
    expect(emissions).toEqual([{ key: 'sources', values: ['23:u74'] }]);
  });
});

describe('TimelineEventItem tracking dropdown', () => {
  let fixture: ComponentFixture<TimelineEventItem>;
  let httpMock: HttpTestingController;

  const USER: User = {
    id: 'user-1',
    username: 'luke',
    displayName: 'Luke Skywalker',
    email: 'luke@example.com',
    emailVerified: true,
    role: 'Standard',
  };

  const TRACKED_MOVIE_DTO: LibraryItemDto = {
    sourceMaterialId: 11,
    title: 'A New Hope',
    medium: 0,
    canonType: 0,
    status: 1,
    isFavorite: false,
    units: [],
  };

  interface SetupOptions {
    medium: string;
    unit?: Record<string, unknown>;
    catalogUnits?: readonly Record<string, unknown>[];
    library?: readonly LibraryItemDto[];
  }

  async function setupTracking(options: SetupOptions): Promise<void> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [TimelineEventItem],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { currentUser: signal(USER) } },
      ],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);

    fixture = TestBed.createComponent(TimelineEventItem);
    fixture.componentRef.setInput('event', {
      id: 1,
      canon: ['Canon'],
      title: 'Test Event',
      description: '',
      sources: [
        {
          title: 'Test Source',
          medium: options.medium,
          canon: ['Canon'],
          sourceId: 11,
          ...(options.unit !== undefined && { unit: options.unit }),
        },
      ],
      locations: [],
      characters: [],
      vehicles: [],
      yearStart: 0,
      yearEnd: 0,
      sequence: 1,
    });
    fixture.detectChanges();

    httpMock.expectOne(`${API_BASE}/users/user-1/source-materials`).flush(options.library ?? []);
    // Signed-in cards fetch every depicted material's unit cache.
    httpMock.expectOne(`${API_BASE}/source-materials/11/units`).flush(options.catalogUnits ?? []);
    fixture.detectChanges();
  }

  function trackSelect(): HTMLSelectElement {
    return fixture.nativeElement.querySelector('.event-track-select') as HTMLSelectElement;
  }

  function selectedOptionText(select: HTMLSelectElement): string {
    return (select.options[select.selectedIndex] as HTMLOptionElement).textContent?.trim() ?? '';
  }

  afterEach(() => {
    httpMock.verify();
  });

  it('shows a material-level dropdown with the current status for a movie', async () => {
    await setupTracking({ medium: 'Movie', library: [TRACKED_MOVIE_DTO] });

    const select = trackSelect();
    expect(select).toBeTruthy();
    expect(selectedOptionText(select)).toBe('Completed');
    const values = [...select.options].map((option) => option.value);
    expect(values).toEqual(['', 'In progress', 'Completed', 'Wish Listed', 'remove']);
  });

  it('offers statuses without Remove until the material is tracked', async () => {
    await setupTracking({ medium: 'Video Game' });

    const select = trackSelect();
    expect(select).toBeTruthy();
    const values = [...select.options].map((option) => option.value);
    expect(values).toEqual(['', 'In progress', 'Completed', 'Wish Listed']);
    expect(selectedOptionText(select)).toBe('Track…');
  });

  it('adds an untracked book to the library with the chosen status', async () => {
    await setupTracking({ medium: 'Book' });

    const select = trackSelect();
    select.value = 'In progress';
    select.dispatchEvent(new Event('change'));

    const post = httpMock.expectOne(`${API_BASE}/users/user-1/source-materials`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ sourceMaterialId: 11, status: 0 });
    post.flush(null);
    httpMock.expectOne(`${API_BASE}/users/user-1/source-materials`).flush([]);
  });

  it('updates material-level status directly once tracked', async () => {
    await setupTracking({ medium: 'Movie', library: [TRACKED_MOVIE_DTO] });

    const select = trackSelect();
    select.value = 'Wish Listed';
    select.dispatchEvent(new Event('change'));

    const put = httpMock.expectOne(`${API_BASE}/users/user-1/source-materials/11`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ status: 2 });
    put.flush(null);
    httpMock.expectOne(`${API_BASE}/users/user-1/source-materials/11`).flush(TRACKED_MOVIE_DTO);
  });

  it('removes a tracked material from the library', async () => {
    await setupTracking({ medium: 'Movie', library: [TRACKED_MOVIE_DTO] });

    const select = trackSelect();
    select.value = 'remove';
    select.dispatchEvent(new Event('change'));

    const remove = httpMock.expectOne(`${API_BASE}/users/user-1/source-materials/11`);
    expect(remove.request.method).toBe('DELETE');
    remove.flush(null);
    httpMock.expectOne(`${API_BASE}/users/user-1/source-materials`).flush([]);
  });

  it('tracks comics at the volume level resolved from the catalog units', async () => {
    await setupTracking({
      medium: 'Comic',
      unit: { unitType: 'Issue', parentUnitId: 301, number: 5 },
      catalogUnits: [
        { id: 301, sourceMaterialId: 11, unitType: 4, parentUnitId: null, number: 2, title: null },
        { id: 305, sourceMaterialId: 11, unitType: 2, parentUnitId: 301, number: 5, title: null },
      ],
      library: [],
    });

    const select = trackSelect();
    expect(select).toBeTruthy();
    expect(selectedOptionText(select)).toBe('Track…');

    select.value = 'Completed';
    select.dispatchEvent(new Event('change'));

    const post = httpMock.expectOne(`${API_BASE}/users/user-1/source-materials`);
    expect(post.request.body).toEqual({ sourceMaterialId: 11, status: 1 });
    post.flush(null);
    httpMock.expectOne(`${API_BASE}/users/user-1/source-materials`).flush([TRACKED_MOVIE_DTO]);
    const put = httpMock.expectOne(`${API_BASE}/users/user-1/source-materials/11`);
    expect(put.request.body).toEqual({ status: 1, unitId: 301 });
    put.flush(null);
    httpMock.expectOne(`${API_BASE}/users/user-1/source-materials/11`).flush(TRACKED_MOVIE_DTO);
  });

  it('derives the season status from tracked episodes for shows', async () => {
    await setupTracking({
      medium: 'Animated Show',
      unit: { unitType: 'Episode', parentUnitId: 107, number: 9 },
      catalogUnits: [
        { id: 107, sourceMaterialId: 11, unitType: 3, parentUnitId: null, number: 7, title: null },
        { id: 207, sourceMaterialId: 11, unitType: 0, parentUnitId: 107, number: 9, title: null },
      ],
      library: [
        {
          sourceMaterialId: 11,
          title: 'The Clone Wars',
          medium: 3,
          canonType: 0,
          status: 0,
          isFavorite: false,
          units: [
            { id: 107, unitType: 3, number: 7, title: null, status: null },
            { id: 207, unitType: 0, number: 9, title: null, status: 1, parentUnitId: 107 },
            { id: 208, unitType: 0, number: 10, title: null, status: null, parentUnitId: 107 },
          ],
        },
      ],
    });

    const select = trackSelect();
    expect(select).toBeTruthy();
    expect(selectedOptionText(select)).toBe('In progress');

    select.value = 'Completed';
    select.dispatchEvent(new Event('change'));
    const put = httpMock.expectOne(`${API_BASE}/users/user-1/source-materials/11`);
    expect(put.request.body).toEqual({ status: 1, unitId: 107 });
    put.flush(null);
    httpMock.expectOne(`${API_BASE}/users/user-1/source-materials/11`).flush(TRACKED_MOVIE_DTO);
  });

  it('hides the season dropdown when no explicit season container exists', async () => {
    await setupTracking({
      medium: 'Live Action Show',
      unit: { unitType: 'Episode', parentUnitId: null, number: 4 },
      catalogUnits: [
        { id: 204, sourceMaterialId: 11, unitType: 0, parentUnitId: null, number: 4, title: null },
      ],
      library: [],
    });

    expect(trackSelect()).toBeNull();
  });

  it('shows the episode detail without the season scope once the season resolves', async () => {
    await setupTracking({
      medium: 'Animated Show',
      unit: {
        id: 207,
        unitType: 'Episode',
        parentUnitId: 107,
        number: 9,
        title: 'The Siege of Mandalore',
      },
      catalogUnits: [
        { id: 107, sourceMaterialId: 11, unitType: 3, parentUnitId: null, number: 7, title: null },
        {
          id: 207,
          sourceMaterialId: 11,
          unitType: 0,
          parentUnitId: 107,
          number: 9,
          title: 'The Siege of Mandalore',
        },
      ],
      library: [],
    });

    const unit = fixture.nativeElement.querySelector('.event-source-unit') as HTMLElement;
    expect(unit.textContent?.trim()).toBe('Episode 9: The Siege of Mandalore');
  });
});
