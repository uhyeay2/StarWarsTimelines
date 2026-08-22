import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FilterTreeNode } from '../../models/timeline-filters';
import { FilterTree, IndeterminateDirective } from './filter-tree';

function leaf(value: string): FilterTreeNode {
  return { value, label: value };
}

describe('IndeterminateDirective', () => {
  @Component({
    imports: [IndeterminateDirective],
    template: '<input type="checkbox" [appIndeterminate]="value()" />',
  })
  class Host {
    readonly value = signal<boolean | undefined>(true);
  }

  it('sets the indeterminate property on the host input', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();

    const input = () => fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input().indeterminate).toBe(true);

    fixture.componentInstance.value.set(false);
    fixture.detectChanges();
    expect(input().indeterminate).toBe(false);

    fixture.componentInstance.value.set(undefined);
    fixture.detectChanges();
    expect(input().indeterminate).toBe(false);
  });
});

describe('FilterTree', () => {
  let fixture: ComponentFixture<FilterTree>;
  const parent: FilterTreeNode = {
    value: 'movies',
    label: 'Movies',
    children: [leaf('a-new-hope'), leaf('empire')],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FilterTree],
    }).compileComponents();

    fixture = TestBed.createComponent(FilterTree);
    fixture.componentRef.setInput('node', parent);
    fixture.componentRef.setInput('selected', ['a-new-hope', 'empire']);
    fixture.detectChanges();
  });

  it('renders the node label and its leaves when expanded', () => {
    const labels = Array.from(
      fixture.nativeElement.querySelectorAll('.filter-option-label') as NodeListOf<HTMLElement>,
    ).map((el) => el.textContent?.trim());

    expect(labels).toEqual(['Movies', 'a-new-hope', 'empire']);
  });

  it('marks a fully selected parent as checked and not indeterminate', () => {
    const checkbox = fixture.nativeElement.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;

    expect(checkbox.checked).toBe(true);
    expect(checkbox.indeterminate).toBe(false);
  });

  it('marks a partially selected parent as indeterminate', () => {
    fixture.componentRef.setInput('selected', ['a-new-hope']);
    fixture.detectChanges();

    const checkbox = fixture.nativeElement.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;

    expect(checkbox.checked).toBe(false);
    expect(checkbox.indeterminate).toBe(true);
  });

  it('emits the toggled node through its own output and bubbles child toggles', () => {
    const emitted: string[] = [];
    fixture.componentInstance.toggle.subscribe((node) => emitted.push(node.value));

    const checkboxes = fixture.nativeElement.querySelectorAll(
      'input[type="checkbox"]',
    ) as NodeListOf<HTMLInputElement>;
    checkboxes[1].click();

    expect(emitted).toEqual(['a-new-hope']);
  });

  it('starts expanded at or below defaultExpandedDepth and collapses on demand', () => {
    expect(fixture.nativeElement.querySelector('.filter-option-children')).toBeTruthy();

    const expandButton = fixture.nativeElement.querySelector(
      '.filter-option-expand',
    ) as HTMLButtonElement;
    expandButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.filter-option-children')).toBeNull();
  });

  it('renders collapsed beyond defaultExpandedDepth until expanded', () => {
    fixture = TestBed.createComponent(FilterTree);
    fixture.componentRef.setInput('node', parent);
    fixture.componentRef.setInput('selected', []);
    fixture.componentRef.setInput('depth', 3);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.filter-option-children')).toBeNull();
  });
});
