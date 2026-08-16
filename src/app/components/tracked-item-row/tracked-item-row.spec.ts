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
    { id: 'unit-1', unitType: 'Episode', groupNumber: 1, number: 1, title: 'Attack of the Clones', isCompleted: true },
    { id: 'unit-2', unitType: 'Episode', groupNumber: 1, number: 2, title: 'Sneak Preview', isCompleted: false },
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
    expect(options).toEqual(['In progress', 'Completed', 'Wish Listed']);
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

  it('emits favoriteChange and remove from their buttons', () => {
    let favoriteToggled = false;
    let removed = false;
    component.favoriteChange.subscribe(() => (favoriteToggled = true));
    component.remove.subscribe(() => (removed = true));
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.favorite-button') as HTMLElement).click();
    (fixture.nativeElement.querySelector('.remove-button') as HTMLElement).click();

    expect(favoriteToggled).toBe(true);
    expect(removed).toBe(true);
  });

  it('marks the favorite button as active when the item is favorited', () => {
    fixture.componentRef.setInput('item', { ...ITEM, favorite: true });
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('.favorite-button') as HTMLElement;
    expect(button.classList.contains('favorite-button--active')).toBe(true);
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

  it('shows unit checkboxes instead of a status select for unit-based items', () => {
    fixture.componentRef.setInput('item', UNIT_ITEM);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('select')).toBeNull();
    expect(compiled.querySelector('.status-badge')?.textContent).toContain('In progress');

    const checkboxes = compiled.querySelectorAll('.unit-checkbox') as NodeListOf<HTMLInputElement>;
    expect(checkboxes.length).toBe(2);
    expect(checkboxes[0].checked).toBe(true);
    expect(checkboxes[1].checked).toBe(false);
    expect(compiled.textContent).toContain('Season 1 · Episode 1: Attack of the Clones');
    expect(compiled.textContent).toContain('Season 1 · Episode 2: Sneak Preview');
  });

  it('labels units without a group number using just the unit type and number', () => {
    fixture.componentRef.setInput('item', {
      ...UNIT_ITEM,
      units: [{ id: 'unit-1', unitType: 'Chapter', number: 1, title: 'The Menace', isCompleted: false }],
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Chapter 1: The Menace');
  });

  it('emits unitProgressChange when a unit checkbox changes', () => {
    fixture.componentRef.setInput('item', UNIT_ITEM);
    fixture.detectChanges();
    const emissions: { unitId: string; isCompleted: boolean }[] = [];
    component.unitProgressChange.subscribe((value) => emissions.push(value));

    const checkbox = fixture.nativeElement.querySelectorAll('.unit-checkbox')[1] as HTMLInputElement;
    checkbox.click();

    expect(emissions).toEqual([{ unitId: 'unit-2', isCompleted: true }]);
  });

  it('still shows the status select for items without units', () => {
    fixture.componentRef.setInput('item', ITEM);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('select')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('.unit-checkbox').length).toBe(0);
  });
});
