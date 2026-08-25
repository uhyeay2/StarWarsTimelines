import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TimelineSkeleton } from './timeline-skeleton';

describe('TimelineSkeleton', () => {
  let fixture: ComponentFixture<TimelineSkeleton>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TimelineSkeleton],
    }).compileComponents();

    fixture = TestBed.createComponent(TimelineSkeleton);
  });

  it('renders five rows by default', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.skeleton-item').length).toBe(5);
  });

  it('renders one row per requested count', () => {
    fixture.componentRef.setInput('rows', 2);
    fixture.detectChanges();

    const items = fixture.nativeElement.querySelectorAll('.skeleton-item');
    expect(items.length).toBe(2);
  });
});
