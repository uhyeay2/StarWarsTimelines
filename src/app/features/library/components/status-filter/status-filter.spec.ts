import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StatusFilter } from './status-filter';

async function setup(): Promise<{
  fixture: ComponentFixture<StatusFilter>;
  component: StatusFilter;
}> {
  await TestBed.configureTestingModule({
    imports: [StatusFilter],
  }).compileComponents();

  const fixture = TestBed.createComponent(StatusFilter);
  const component = fixture.componentInstance;
  fixture.detectChanges();
  return { fixture, component };
}

function tab(fixture: ComponentFixture<StatusFilter>, label: string): HTMLElement {
  return [...fixture.nativeElement.querySelectorAll('.filter-tab')].find(
    (el) => (el as HTMLElement).textContent?.trim() === label,
  ) as HTMLElement;
}

function activeLabels(fixture: ComponentFixture<StatusFilter>): string[] {
  return [...fixture.nativeElement.querySelectorAll('.filter-tab--active')].map((el) =>
    (el as HTMLElement).textContent?.trim(),
  );
}

describe('StatusFilter', () => {
  it('defaults to All selected with no explicit statuses', async () => {
    const { fixture, component } = await setup();
    expect(component.selection()).toEqual([]);
    expect(component.allSelected()).toBe(true);
    expect(activeLabels(fixture)).toEqual(['All']);
  });

  it('renders an All tab plus one tab per tracking status', async () => {
    const { fixture } = await setup();
    const labels = [...fixture.nativeElement.querySelectorAll('.filter-tab')].map((el) =>
      (el as HTMLElement).textContent?.trim(),
    );
    expect(labels).toEqual(['All', 'In progress', 'Completed', 'Wish Listed']);
  });

  it('allows multiple statuses to be selected together', async () => {
    const { fixture, component } = await setup();
    tab(fixture, 'Completed').click();
    fixture.detectChanges();
    tab(fixture, 'Wish Listed').click();
    fixture.detectChanges();

    expect(component.selection()).toEqual(['Completed', 'Wish Listed']);
    expect(activeLabels(fixture)).toEqual(['Completed', 'Wish Listed']);
  });

  it('toggles a selected status back off', async () => {
    const { fixture, component } = await setup();
    component.selection.set(['Completed', 'Wish Listed']);
    fixture.detectChanges();

    tab(fixture, 'Wish Listed').click();
    fixture.detectChanges();

    expect(component.selection()).toEqual(['Completed']);
  });

  it('selecting All clears the explicit selection', async () => {
    const { fixture, component } = await setup();
    component.selection.set(['Completed']);
    fixture.detectChanges();

    tab(fixture, 'All').click();
    fixture.detectChanges();

    expect(component.selection()).toEqual([]);
    expect(component.allSelected()).toBe(true);
    expect(activeLabels(fixture)).toEqual(['All']);
  });

  it('auto-selects All when the last status is deselected', async () => {
    const { fixture, component } = await setup();
    component.selection.set(['In progress']);
    fixture.detectChanges();

    tab(fixture, 'In progress').click();
    fixture.detectChanges();

    expect(component.selection()).toEqual([]);
    expect(component.allSelected()).toBe(true);
    expect(activeLabels(fixture)).toEqual(['All']);
  });

  it('updates aria-pressed on the tabs', async () => {
    const { fixture, component } = await setup();
    component.selection.set(['Completed']);
    fixture.detectChanges();

    const completed = tab(fixture, 'Completed');
    const all = tab(fixture, 'All');
    expect(completed.getAttribute('aria-checked')).toBe('true');
    expect(all.getAttribute('aria-checked')).toBe('false');
  });

  it('emits model updates to two-way bound parents', async () => {
    const { fixture, component } = await setup();
    let emitted: readonly string[] | undefined;
    component.selection.subscribe((value) => (emitted = value));

    tab(fixture, 'Completed').click();

    expect(emitted).toEqual(['Completed']);
  });
});
