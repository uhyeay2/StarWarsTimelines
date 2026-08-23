import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { environment } from '../../../environments/environment';
import { User } from '../../models/user';
import { AuthService } from '../../services/auth/auth.service';
import { LibraryItemDto } from '../../services/library/library.dto';
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
      id: 'test-event',
      canon: ['Canon', 'Legends'],
      title: 'Test Event',
      description: 'A test event description.',
      sources: [
        { title: 'Test Source', medium: 'Book', canon: ['Canon', 'Legends'] },
      ],
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
    const tatooine = chips.find(
      (chip) => chip.textContent?.trim() === 'Tatooine',
    ) as HTMLElement;
    const luke = chips.find(
      (chip) => chip.textContent?.trim() === 'Luke Skywalker',
    ) as HTMLElement;
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
    sources[0].click();
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
    sources[1].click();
    expect(emissions).toEqual([{ key: 'sources', values: ['material-tcw:2'] }]);
  });

  it('emits the chapter key when a book chapter chip is clicked', () => {
    const emissions: ToggleFacetEvent[] = [];
    component.toggleFacet.subscribe((event) => emissions.push(event));
    fixture.componentRef.setInput('event', {
      id: 'test-event',
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
      { label: 'Shatterpoint', values: ['material-shatterpoint:chapter-1', 'material-shatterpoint:chapter-2'] },
      { label: 'Chapter 2', values: ['material-shatterpoint:chapter-2'] },
    ]);
    fixture.detectChanges();
    const sources = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('.source-chip--source'),
    ] as HTMLElement[];
    sources[1].click();
    expect(emissions).toEqual([{ key: 'sources', values: ['material-shatterpoint:chapter-2'] }]);
  });

  it('renders the source unit detail next to the chips when the event has a unit', () => {
    fixture.componentRef.setInput('event', {
      id: 'test-event',
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
            groupNumber: 7,
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
          unit: { unitType: 'Episode', groupNumber: 7, number: 9, title: 'The Siege of Mandalore' },
        },
        {
          title: 'Darth Vader (2017)',
          medium: 'Comic',
          canon: ['Legends'],
          sourceId: 'material-dv',
          unit: { unitType: 'Issue', groupNumber: 1, number: 6 },
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
      id: 'test-event',
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
    expect(fixture.nativeElement.querySelector('.event-source-unit')).toBeNull();
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
    sourceMaterialId: 'mat-1',
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
      id: 'test-event',
      canon: ['Canon'],
      title: 'Test Event',
      description: '',
      sources: [
        {
          title: 'Test Source',
          medium: options.medium,
          canon: ['Canon'],
          sourceId: 'mat-1',
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

    httpMock
      .expectOne(`${API_BASE}/users/user-1/source-materials`)
      .flush(options.library ?? []);
    if (options.catalogUnits !== undefined) {
      httpMock.expectOne(`${API_BASE}/source-materials/mat-1/units`).flush(options.catalogUnits);
    }
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
    expect(post.request.body).toEqual({ sourceMaterialId: 'mat-1', status: 0 });
    post.flush(null);
    httpMock.expectOne(`${API_BASE}/users/user-1/source-materials`).flush([]);
  });

  it('updates material-level status directly once tracked', async () => {
    await setupTracking({ medium: 'Movie', library: [TRACKED_MOVIE_DTO] });

    const select = trackSelect();
    select.value = 'Wish Listed';
    select.dispatchEvent(new Event('change'));

    const put = httpMock.expectOne(`${API_BASE}/users/user-1/source-materials/mat-1`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ status: 2 });
    put.flush(null);
    httpMock
      .expectOne(`${API_BASE}/users/user-1/source-materials/mat-1`)
      .flush(TRACKED_MOVIE_DTO);
  });

  it('removes a tracked material from the library', async () => {
    await setupTracking({ medium: 'Movie', library: [TRACKED_MOVIE_DTO] });

    const select = trackSelect();
    select.value = 'remove';
    select.dispatchEvent(new Event('change'));

    const remove = httpMock.expectOne(`${API_BASE}/users/user-1/source-materials/mat-1`);
    expect(remove.request.method).toBe('DELETE');
    remove.flush(null);
    httpMock.expectOne(`${API_BASE}/users/user-1/source-materials`).flush([]);
  });

  it('tracks comics at the volume level resolved from the catalog units', async () => {
    await setupTracking({
      medium: 'Comic',
      unit: { unitType: 'Issue', groupNumber: 2, number: 5 },
      catalogUnits: [
        { id: 'unit-vol2', sourceMaterialId: 'mat-1', unitType: 4, groupNumber: null, number: 2, title: null },
        { id: 'unit-issue5', sourceMaterialId: 'mat-1', unitType: 2, groupNumber: 2, number: 5, title: null },
      ],
      library: [],
    });

    const select = trackSelect();
    expect(select).toBeTruthy();
    expect(selectedOptionText(select)).toBe('Track…');

    select.value = 'Completed';
    select.dispatchEvent(new Event('change'));

    const post = httpMock.expectOne(`${API_BASE}/users/user-1/source-materials`);
    expect(post.request.body).toEqual({ sourceMaterialId: 'mat-1', status: 1 });
    post.flush(null);
    httpMock.expectOne(`${API_BASE}/users/user-1/source-materials`).flush([TRACKED_MOVIE_DTO]);
    const put = httpMock.expectOne(`${API_BASE}/users/user-1/source-materials/mat-1`);
    expect(put.request.body).toEqual({ status: 1, unitId: 'unit-vol2' });
    put.flush(null);
    httpMock
      .expectOne(`${API_BASE}/users/user-1/source-materials/mat-1`)
      .flush(TRACKED_MOVIE_DTO);
  });

  it('derives the season status from tracked episodes for shows', async () => {
    await setupTracking({
      medium: 'Animated Show',
      unit: { unitType: 'Episode', groupNumber: 7, number: 9 },
      catalogUnits: [
        { id: 'unit-s7', sourceMaterialId: 'mat-1', unitType: 3, groupNumber: null, number: 7, title: null },
        { id: 'unit-ep9', sourceMaterialId: 'mat-1', unitType: 0, groupNumber: 7, number: 9, title: null },
      ],
      library: [
        {
          sourceMaterialId: 'mat-1',
          title: 'The Clone Wars',
          medium: 3,
          canonType: 0,
          status: 0,
          isFavorite: false,
          units: [
            { id: 'unit-s7', unitType: 3, groupNumber: null, number: 7, title: null, isCompleted: false, isTracked: false },
            { id: 'unit-ep9', unitType: 0, groupNumber: 7, number: 9, title: null, isCompleted: true, isTracked: true },
            { id: 'unit-ep10', unitType: 0, groupNumber: 7, number: 10, title: null, isCompleted: false, isTracked: false },
          ],
        },
      ],
    });

    const select = trackSelect();
    expect(select).toBeTruthy();
    expect(selectedOptionText(select)).toBe('In progress');

    select.value = 'Completed';
    select.dispatchEvent(new Event('change'));
    const put = httpMock.expectOne(`${API_BASE}/users/user-1/source-materials/mat-1`);
    expect(put.request.body).toEqual({ status: 1, unitId: 'unit-s7' });
    put.flush(null);
    httpMock
      .expectOne(`${API_BASE}/users/user-1/source-materials/mat-1`)
      .flush(TRACKED_MOVIE_DTO);
  });

  it('hides the season dropdown when no explicit season container exists', async () => {
    await setupTracking({
      medium: 'Live Action Show',
      unit: { unitType: 'Episode', groupNumber: 1, number: 4 },
      catalogUnits: [
        { id: 'unit-ep4', sourceMaterialId: 'mat-1', unitType: 0, groupNumber: 1, number: 4, title: null },
      ],
      library: [],
    });

    expect(trackSelect()).toBeNull();
  });
});
