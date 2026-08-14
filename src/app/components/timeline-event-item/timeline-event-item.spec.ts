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

  it('renders the event details', () => {
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
    const compiled = fixture.nativeElement as HTMLElement;
    const chips = [...compiled.querySelectorAll('button.chip')];
    expect(chips.length).toBe(3);
    expect(chips.every((chip) => chip.getAttribute('aria-pressed') === 'false')).toBe(true);
  });

  it('highlights chips that are selected in the filters', () => {
    fixture.componentRef.setInput('selectedLocations', ['Tatooine']);
    fixture.componentRef.setInput('selectedCharacters', ['Luke Skywalker']);
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
    const compiled = fixture.nativeElement as HTMLElement;
    const falcon = [...compiled.querySelectorAll('button.chip')].find(
      (chip) => chip.textContent?.trim() === 'Millennium Falcon',
    ) as HTMLElement;
    falcon.click();
    expect(emissions).toEqual([{ key: 'vehicles', value: 'Millennium Falcon' }]);
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
});
