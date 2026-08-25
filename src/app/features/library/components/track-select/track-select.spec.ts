import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TrackSelect } from './track-select';

describe('TrackSelect', () => {
  let fixture: ComponentFixture<TrackSelect>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrackSelect],
    }).compileComponents();

    fixture = TestBed.createComponent(TrackSelect);
    fixture.componentRef.setInput('label', 'Track A New Hope');
    fixture.componentRef.setInput('options', ['In progress', 'Completed', 'remove']);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('renders the accessible label and placeholder option', () => {
    const select = fixture.nativeElement.querySelector('.track-select') as HTMLSelectElement;

    expect(select.getAttribute('aria-label')).toBe('Track A New Hope');
    expect(select.querySelectorAll('option').length).toBe(4);
    expect(
      (select.querySelector('option[value=""]') as HTMLOptionElement).textContent?.trim(),
    ).toBe('Track…');
  });

  it('preselects the current status when tracked', () => {
    fixture.componentRef.setInput('currentStatus', 'Completed');
    fixture.detectChanges();

    const select = fixture.nativeElement.querySelector('.track-select') as HTMLSelectElement;
    const selected = Array.from(select.options).find((option) => option.selected);

    expect(selected?.value).toBe('Completed');
  });

  it('labels the remove option for screen readers and display', () => {
    const remove = fixture.nativeElement.querySelector(
      '.track-select option.remove-option',
    ) as HTMLOptionElement;

    expect(remove.value).toBe('remove');
    expect(remove.textContent?.trim()).toBe('Remove From Library');
  });

  it('emits the selected value on change', () => {
    const emitted: string[] = [];
    fixture.componentInstance.statusChange.subscribe((value) => emitted.push(value));
    const select = fixture.nativeElement.querySelector('.track-select') as HTMLSelectElement;

    select.value = 'In progress';
    select.dispatchEvent(new Event('change'));

    expect(emitted).toEqual(['In progress']);
  });

  it('flags group variants with the group class', () => {
    expect(fixture.nativeElement.querySelector('.track-select.group-track-select')).toBeNull();

    fixture.componentRef.setInput('variant', 'group');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.track-select.group-track-select')).toBeTruthy();
  });
});
