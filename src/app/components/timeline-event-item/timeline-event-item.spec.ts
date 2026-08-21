import { ComponentFixture, TestBed } from '@angular/core/testing';

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
      source: {
        title: 'The Clone Wars',
        medium: 'Animated Show',
        sourceId: 'material-tcw',
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

  it('omits the unit detail for a chapter unit without a title', () => {
    fixture.componentRef.setInput('event', {
      id: 'test-event',
      canon: ['Canon'],
      title: 'Test Event',
      description: 'A test event description.',
      source: {
        title: 'Shatterpoint',
        medium: 'Book',
        sourceId: 'material-shatterpoint',
        unit: { unitType: 'Chapter', number: 1 },
      },
      locations: [],
      characters: [],
      vehicles: [],
      year: -19,
      displayDate: '19 BBY',
    });
    fixture.componentRef.setInput('sourceChips', [
      { label: 'Shatterpoint', values: ['material-shatterpoint:chapter-1'] },
      { label: 'Chapter 1', values: ['material-shatterpoint:chapter-1'] },
    ]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.event-source-unit')).toBeNull();
  });
});
