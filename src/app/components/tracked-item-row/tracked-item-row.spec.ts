import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LibraryItem } from '../../models/library-item';
import { TrackingStatus } from '../../models/tracking-status';
import { TrackedItemRow } from './tracked-item-row';

const ITEM: LibraryItem = {
  id: 'material-episode-iv',
  title: 'Star Wars: Episode IV - A New Hope',
  medium: 'Movie',
  status: 'Completed',
  favorite: false,
};

const UNIT_ITEM: LibraryItem = {
  id: 'material-episode-ii',
  title: 'Star Wars: Episode II - Attack of the Clones',
  medium: 'Movie',
  status: 'In progress',
  favorite: false,
  units: [
    { id: 'season-1', unitType: 'Season', number: 1, title: 'Season 1', isCompleted: false, isTracked: true },
    { id: 'unit-1', unitType: 'Episode', groupNumber: 1, number: 1, title: 'Attack of the Clones', isCompleted: true },
    { id: 'unit-2', unitType: 'Episode', groupNumber: 1, number: 2, title: 'Sneak Preview', isCompleted: false },
  ],
};

const UNIT_ITEM_WITHOUT_SEASONS: LibraryItem = {
  id: 'material-episode-ii',
  title: 'Star Wars: Episode II - Attack of the Clones',
  medium: 'Movie',
  status: 'In progress',
  favorite: false,
  units: [
    { id: 'unit-1', unitType: 'Episode', groupNumber: 1, number: 1, title: 'Attack of the Clones', isCompleted: true },
    { id: 'unit-2', unitType: 'Episode', groupNumber: 1, number: 2, title: 'Sneak Preview', isCompleted: false },
  ],
};

const UNIT_ITEM_MULTI_SEASON: LibraryItem = {
  id: 'material-rebels',
  title: 'Star Wars: Rebels',
  medium: 'Live Action Show',
  status: 'In progress',
  favorite: false,
  units: [
    { id: 's1-container', unitType: 'Season', number: 1, title: 'Season 1', isCompleted: false, isTracked: true },
    { id: 's2-container', unitType: 'Season', number: 2, title: 'Season 2', isCompleted: false, isTracked: false },
    { id: 's3-container', unitType: 'Season', number: 3, title: 'Season 3', isCompleted: true, isTracked: true },
    { id: 'e1', unitType: 'Episode', groupNumber: 1, number: 1, title: 'Pilot', isCompleted: true },
    { id: 'e2', unitType: 'Episode', groupNumber: 2, number: 1, title: 'The Disappeared', isCompleted: false },
    { id: 'e3', unitType: 'Episode', groupNumber: 3, number: 1, title: 'Future Heroes', isCompleted: true },
  ],
};

const UNIT_ITEM_NO_TRACKED_SEASONS: LibraryItem = {
  id: 'material-mandalorian',
  title: 'The Mandalorian',
  medium: 'Live Action Show',
  status: 'Wish Listed',
  favorite: false,
  units: [
    { id: 's1-container', unitType: 'Season', number: 1, title: 'Season 1', isCompleted: false },
    { id: 's2-container', unitType: 'Season', number: 2, title: 'Season 2', isCompleted: false },
    { id: 'e1', unitType: 'Episode', groupNumber: 1, number: 1, title: 'Chapter 1', isCompleted: false },
    { id: 'e2', unitType: 'Episode', groupNumber: 2, number: 1, title: 'Chapter 2', isCompleted: false },
  ],
};

describe('TrackedItemRow', () => {
  let component: TrackedItemRow;
  let fixture: ComponentFixture<TrackedItemRow>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrackedItemRow],
    }).compileComponents();

    fixture = TestBed.createComponent(TrackedItemRow);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('item', ITEM);
    await fixture.whenStable();
  });

  it('renders the title, medium, and status', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Star Wars: Episode IV - A New Hope');
    expect(compiled.textContent).toContain('Movie');
    const select = compiled.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe('Completed');
  });

  it('offers only the three active tracking statuses', () => {
    fixture.detectChanges();
    const options = [...fixture.nativeElement.querySelectorAll('option')].map(
      (option) => (option as HTMLOptionElement).value,
    );
    expect(options).toEqual(['In progress', 'Completed', 'Wish Listed', 'remove']);
  });

  it('emits statusChange when the status select changes', () => {
    const emissions: TrackingStatus[] = [];
    component.statusChange.subscribe((status) => emissions.push(status));
    fixture.detectChanges();

    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    select.value = 'Wish Listed';
    select.dispatchEvent(new Event('change'));

    expect(emissions).toEqual(['Wish Listed']);
  });

  it('emits remove from the Remove From Library option in the status select', () => {
    let removed = false;
    component.remove.subscribe(() => (removed = true));
    fixture.detectChanges();

    const select = fixture.nativeElement.querySelector('select.status-select') as HTMLSelectElement;
    select.value = 'remove';
    select.dispatchEvent(new Event('change'));

    expect(removed).toBe(true);
  });

  it('hides reorder controls and drag behavior by default', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.move-button').length).toBe(0);
    expect(fixture.nativeElement.querySelector('.drag-handle')).toBeNull();
    expect(
      (fixture.nativeElement.querySelector('.tracked-item-row') as HTMLElement).getAttribute('draggable'),
    ).toBeNull();
  });

  it('shows reorder controls and enables dragging when showReorder is set', () => {
    fixture.componentRef.setInput('showReorder', true);
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('.move-button');
    expect(buttons.length).toBe(2);
    expect(fixture.nativeElement.querySelector('.drag-handle')).toBeTruthy();
    expect(
      (fixture.nativeElement.querySelector('.tracked-item-row') as HTMLElement).getAttribute('draggable'),
    ).toBe('true');
  });

  it('disables move up for the first item and move down for the last item', () => {
    fixture.componentRef.setInput('showReorder', true);
    fixture.componentRef.setInput('first', true);
    fixture.componentRef.setInput('last', true);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('.move-button') as NodeListOf<HTMLButtonElement>;
    expect(buttons[0].disabled).toBe(true);
    expect(buttons[1].disabled).toBe(true);
  });

  it('emits reorder and drag events when showReorder is enabled', () => {
    let movedUp = 0;
    let movedDown = 0;
    let dragStarts = 0;
    let dragEnds = 0;
    let dragOverEvent: Event | null = null;
    let drops = 0;
    component.moveUp.subscribe(() => movedUp++);
    component.moveDown.subscribe(() => movedDown++);
    component.dragStart.subscribe(() => dragStarts++);
    component.dragEnd.subscribe(() => dragEnds++);
    component.dragOver.subscribe((event) => (dragOverEvent = event));
    component.drop.subscribe(() => drops++);

    fixture.componentRef.setInput('showReorder', true);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('.move-button') as NodeListOf<HTMLElement>;
    buttons[0].click();
    buttons[1].click();

    const row = fixture.nativeElement.querySelector('.tracked-item-row') as HTMLElement;
    row.dispatchEvent(new Event('dragstart', { bubbles: true }));
    const overEvent = new Event('dragover', { bubbles: true, cancelable: true });
    row.dispatchEvent(overEvent);
    row.dispatchEvent(new Event('dragend', { bubbles: true }));
    row.dispatchEvent(new Event('drop', { bubbles: true }));

    expect(movedUp).toBe(1);
    expect(movedDown).toBe(1);
    expect(dragStarts).toBe(1);
    expect(dragEnds).toBe(1);
    expect(dragOverEvent).toBe(overEvent);
    expect(drops).toBe(1);
  });

  it('marks the row as dragging when the dragging input is set', () => {
    fixture.componentRef.setInput('dragging', true);
    fixture.detectChanges();
    const row = fixture.nativeElement.querySelector('.tracked-item-row') as HTMLElement;
    expect(row.classList.contains('tracked-item-row--dragging')).toBe(true);
  });

  it('shows grouped units with a season status select for unit-based items', () => {
    fixture.componentRef.setInput('item', UNIT_ITEM);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('select.status-select')).toBeNull();
    expect(compiled.querySelector('.status-badge')).toBeNull();

    // Season label is shown with status select
    expect(compiled.textContent).toContain('Season 1');
    expect(compiled.querySelectorAll('select.group-status-select').length).toBe(1);
  });

  it('shows the material status select when units have no Season/Volume containers', () => {
    fixture.componentRef.setInput('item', UNIT_ITEM_WITHOUT_SEASONS);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('select.status-select')).toBeTruthy();
    expect((compiled.querySelector('select.status-select') as HTMLSelectElement).value).toBe('In progress');
    expect(compiled.querySelectorAll('select.group-status-select').length).toBe(0);
  });

  it('uses the material-level controls for books with chapters', () => {
    const emissions: { status?: TrackingStatus; removed?: boolean }[] = [];
    component.statusChange.subscribe((status) => emissions.push({ status }));
    component.remove.subscribe(() => emissions.push({ removed: true }));
    fixture.componentRef.setInput('item', {
      id: 'material-chapter-test',
      title: 'Test Chapter Material',
      medium: 'Book',
      status: 'In progress',
      favorite: false,
      units: [{ id: 'unit-1', unitType: 'Chapter', number: 1, title: 'The Menace', isCompleted: false }],
    });
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).not.toContain('All Units');
    expect(compiled.querySelectorAll('select.group-status-select').length).toBe(0);

    // The select reflects the material's status and emits item-level events,
    // so status updates and Remove From Library work like any other material.
    const select = compiled.querySelector('select.status-select') as HTMLSelectElement;
    expect(select.value).toBe('In progress');

    select.value = 'Completed';
    select.dispatchEvent(new Event('change'));
    select.value = 'remove';
    select.dispatchEvent(new Event('change'));

    expect(emissions).toEqual([{ status: 'Completed' }, { removed: true }]);
  });

  it('emits groupStatusChange when the season status select changes', () => {
    fixture.componentRef.setInput('item', UNIT_ITEM);
    fixture.detectChanges();
    const emissions: { unitId: string; status: TrackingStatus }[] = [];
    component.groupStatusChange.subscribe((value) => emissions.push(value));

    const groupSelect = fixture.nativeElement.querySelector('select.group-status-select') as HTMLSelectElement;
    groupSelect.value = 'Completed';
    groupSelect.dispatchEvent(new Event('change'));

    expect(emissions).toEqual([{ unitId: 'season-1', status: 'Completed' }]);
  });

  it('emits groupRemove (not remove) when a season select chooses "Remove From Library"', () => {
    fixture.componentRef.setInput('item', UNIT_ITEM);
    fixture.detectChanges();
    const removals: { unitId: string }[] = [];
    let materialRemovals = 0;
    component.groupRemove.subscribe((value) => removals.push(value));
    component.remove.subscribe(() => materialRemovals++);

    const groupSelect = fixture.nativeElement.querySelector('select.group-status-select') as HTMLSelectElement;
    groupSelect.value = 'remove';
    groupSelect.dispatchEvent(new Event('change'));

    expect(removals).toEqual([{ unitId: 'season-1' }]);
    expect(materialRemovals).toBe(0);
  });

  it('shows the "Track..." placeholder for untracked seasons', () => {
    // Wholesale-add fallback: no season is tracked, so selects show the placeholder.
    fixture.componentRef.setInput('item', UNIT_ITEM_NO_TRACKED_SEASONS);
    fixture.detectChanges();
    const fallbackSelects = fixture.nativeElement.querySelectorAll(
      'select.group-status-select',
    ) as NodeListOf<HTMLSelectElement>;
    expect(fallbackSelects.length).toBeGreaterThan(0);
    for (const select of Array.from(fallbackSelects)) {
      expect(select.selectedOptions[0]?.textContent).toContain('Track');
    }

    // Mixed case: tracked seasons show their status instead of the placeholder.
    fixture.componentRef.setInput('item', UNIT_ITEM_MULTI_SEASON);
    fixture.detectChanges();
    const trackedSelects = fixture.nativeElement.querySelectorAll(
      'select.group-status-select',
    ) as NodeListOf<HTMLSelectElement>;
    expect(trackedSelects.length).toBe(2);
    for (const select of Array.from(trackedSelects)) {
      expect(select.selectedOptions[0]?.textContent).not.toContain('Track');
    }
  });

  it('still shows the status select for items without units', () => {
    fixture.componentRef.setInput('item', ITEM);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('select')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('.unit-checkbox').length).toBe(0);
  });

  it('shows only tracked seasons when some are tracked', () => {
    fixture.componentRef.setInput('item', UNIT_ITEM_MULTI_SEASON);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Season 1');
    expect(compiled.textContent).toContain('Season 3');
    expect(compiled.textContent).not.toContain('Season 2');
    expect(compiled.querySelectorAll('select.group-status-select').length).toBe(2);
  });

  it('shows all seasons when none are tracked (wholesale-add case)', () => {
    fixture.componentRef.setInput('item', UNIT_ITEM_NO_TRACKED_SEASONS);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Season 1');
    expect(compiled.textContent).toContain('Season 2');
    expect(compiled.querySelectorAll('select.group-status-select').length).toBe(2);
  });
});
