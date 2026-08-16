import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TrackingStatus } from '../../models/tracking-status';
import { TimelineEventItem, ToggleFacetEvent } from './timeline-event-item';

describe('TimelineEventItem', () => {
  let component: TimelineEventItem;
  let fixture: ComponentFixture<TimelineEventItem>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TimelineEventItem],
    }).compileComponents();

    fixture = TestBed.createComponent(TimelineEventItem);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('event', {
      id: 'test-event',
      canon: ['Canon', 'Legends'],
      title: 'Test Event',
      description: 'A test event description.',
      source: { title: 'Test Source', medium: 'Book' },
      locations: ['Tatooine'],
      characters: ['Luke Skywalker'],
      vehicles: ['Millennium Falcon'],
      year: 0,
      displayDate: '0 BBY',
    });
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
    expect(emissions).toEqual([{ key: 'vehicles', value: 'Millennium Falcon' }]);
  });

  it('renders the medium and source title as toggleable source chips', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const medium = compiled.querySelector('.source-chip--medium') as HTMLElement;
    const title = compiled.querySelector('.source-chip--title') as HTMLElement;
    expect(medium).toBeTruthy();
    expect(medium.textContent?.trim()).toBe('Book');
    expect(medium.getAttribute('aria-pressed')).toBe('false');
    expect(title).toBeTruthy();
    expect(title.textContent).toContain('Test Source');
    expect(title.getAttribute('aria-pressed')).toBe('false');
  });

  it('emits a medium toggle event when the medium chip is clicked', () => {
    const emissions: ToggleFacetEvent[] = [];
    component.toggleFacet.subscribe((event) => emissions.push(event));
    fixture.detectChanges();
    const medium = fixture.nativeElement.querySelector('.source-chip--medium') as HTMLElement;
    medium.click();
    expect(emissions).toEqual([{ key: 'mediums', value: 'Book' }]);
  });

  it('emits a source toggle event when the title chip is clicked', () => {
    const emissions: ToggleFacetEvent[] = [];
    component.toggleFacet.subscribe((event) => emissions.push(event));
    fixture.detectChanges();
    const title = fixture.nativeElement.querySelector('.source-chip--title') as HTMLElement;
    title.click();
    expect(emissions).toEqual([{ key: 'sources', value: 'Test Source' }]);
  });

  it('highlights the medium and source chips when their values are selected', () => {
    fixture.componentRef.setInput('selectedMediums', ['Book']);
    fixture.componentRef.setInput('selectedSources', ['Test Source']);
    fixture.detectChanges();
    const medium = fixture.nativeElement.querySelector('.source-chip--medium') as HTMLElement;
    const title = fixture.nativeElement.querySelector('.source-chip--title') as HTMLElement;
    expect(medium.classList.contains('chip--selected')).toBe(true);
    expect(medium.getAttribute('aria-pressed')).toBe('true');
    expect(title.classList.contains('chip--selected')).toBe(true);
    expect(title.getAttribute('aria-pressed')).toBe('true');
  });

  it('emits the grouped season key for a show title chip', () => {
    const emissions: ToggleFacetEvent[] = [];
    component.toggleFacet.subscribe((event) => emissions.push(event));
    fixture.componentRef.setInput('event', {
      id: 'test-event',
      canon: ['Canon'],
      title: 'Test Event',
      description: 'A test event description.',
      source: {
        title: 'The Clone Wars',
        medium: 'Animated Show',
        sourceId: 'material-tcw',
        unit: { unitType: 'Episode', groupNumber: 7, number: 9 },
      },
      locations: [],
      characters: [],
      vehicles: [],
      year: -19,
      displayDate: '19 BBY',
    });
    fixture.detectChanges();
    const title = fixture.nativeElement.querySelector('.source-chip--title') as HTMLElement;
    title.click();
    expect(emissions).toEqual([{ key: 'sources', value: 'material-tcw:7' }]);
  });

  it('emits the chapter key for a book title chip', () => {
    const emissions: ToggleFacetEvent[] = [];
    component.toggleFacet.subscribe((event) => emissions.push(event));
    fixture.componentRef.setInput('event', {
      id: 'test-event',
      canon: ['Canon'],
      title: 'Test Event',
      description: 'A test event description.',
      source: {
        title: 'Shatterpoint',
        medium: 'Book',
        sourceId: 'material-shatterpoint',
        unit: { unitType: 'Chapter', number: 2 },
      },
      locations: [],
      characters: [],
      vehicles: [],
      year: -19,
      displayDate: '19 BBY',
    });
    fixture.detectChanges();
    const title = fixture.nativeElement.querySelector('.source-chip--title') as HTMLElement;
    title.click();
    expect(emissions).toEqual([{ key: 'sources', value: 'material-shatterpoint:chapter-2' }]);
  });

  it('shows no status badge when no status is provided', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.status-badge')).toBeNull();
  });

  it('shows a status badge with the matching style when a status is provided', () => {
    fixture.componentRef.setInput('status', 'In progress');
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('.status-badge') as HTMLElement;
    expect(badge).toBeTruthy();
    expect(badge.textContent?.trim()).toBe('In progress');
    expect(badge.classList.contains('status-badge--in-progress')).toBe(true);
  });

  it('applies the completed and wish-listed badge styles', () => {
    fixture.componentRef.setInput('status', 'Completed');
    fixture.detectChanges();
    expect(
      (fixture.nativeElement.querySelector('.status-badge') as HTMLElement).classList.contains(
        'status-badge--completed',
      ),
    ).toBe(true);

    fixture.componentRef.setInput('status', 'Wish Listed');
    fixture.detectChanges();
    expect(
      (fixture.nativeElement.querySelector('.status-badge') as HTMLElement).classList.contains(
        'status-badge--wish-listed',
      ),
    ).toBe(true);
  });

  it('shows no tracking controls when the user cannot track', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.add-to-library-button')).toBeNull();
    expect(fixture.nativeElement.querySelector('.status-select')).toBeNull();
  });

  it('shows an add to library button when tracking is available and the item is untracked', () => {
    let emitted = false;
    component.addToLibrary.subscribe(() => (emitted = true));
    fixture.componentRef.setInput('canTrack', true);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('.add-to-library-button') as HTMLElement;
    expect(button).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.status-select')).toBeNull();
    button.click();
    expect(emitted).toBe(true);
  });

  it('shows a status select and emits status changes when the item is tracked', () => {
    let emitted: TrackingStatus | undefined;
    component.statusChange.subscribe((status) => (emitted = status));
    fixture.componentRef.setInput('canTrack', true);
    fixture.componentRef.setInput('status', 'In progress');
    fixture.detectChanges();
    const select = fixture.nativeElement.querySelector('.status-select') as HTMLSelectElement;
    expect(select).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.add-to-library-button')).toBeNull();
    expect(select.value).toBe('In progress');

    select.value = 'Completed';
    select.dispatchEvent(new Event('change'));
    expect(emitted).toBe('Completed');
  });

  it('renders the source unit label when the event has a unit', () => {
    fixture.componentRef.setInput('event', {
      id: 'test-event',
      canon: ['Canon', 'Legends'],
      title: 'Test Event',
      description: 'A test event description.',
      source: {
        title: 'The Clone Wars',
        medium: 'Animated Show',
        unit: {
          unitType: 'Episode',
          groupNumber: 7,
          number: 9,
          title: 'The Siege of Mandalore',
        },
      },
      locations: [],
      characters: [],
      vehicles: [],
      year: -19,
      displayDate: '19 BBY',
    });
    fixture.detectChanges();
    const source = fixture.nativeElement.querySelector('.event-source') as HTMLElement;
    expect(source.textContent).toContain('Season 7 · Episode 9: The Siege of Mandalore');
  });

  it('renders a plain episode label when the event unit has no group', () => {
    fixture.componentRef.setInput('event', {
      id: 'test-event',
      canon: ['Canon'],
      title: 'Test Event',
      description: 'A test event description.',
      source: {
        title: 'Shatterpoint',
        medium: 'Book',
        unit: { unitType: 'Chapter', number: 1 },
      },
      locations: [],
      characters: [],
      vehicles: [],
      year: -19,
      displayDate: '19 BBY',
    });
    fixture.detectChanges();
    const source = fixture.nativeElement.querySelector('.event-source') as HTMLElement;
    expect(source.textContent).toContain('Chapter 1');
  });
});
