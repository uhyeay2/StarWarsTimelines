import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ErrorState } from './error-state';

describe('ErrorState', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ErrorState],
    }).compileComponents();
  });

  it('renders default title and retry label', () => {
    const fixture = TestBed.createComponent(ErrorState);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.error-state-title')?.textContent?.trim()).toBe(
      'Something went wrong',
    );
    const retry = fixture.nativeElement.querySelector(
      '.error-state-retry',
    ) as HTMLButtonElement;
    expect(retry.textContent?.trim()).toBe('Try again');
  });

  it('hides the message when none is provided', () => {
    const fixture = TestBed.createComponent(ErrorState);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.error-state-message')).toBeNull();
  });

  it('renders custom inputs and the detail message', () => {
    const fixture = TestBed.createComponent(ErrorState);
    fixture.componentRef.setInput('title', 'Timeline failed');
    fixture.componentRef.setInput('message', 'The server is unreachable.');
    fixture.componentRef.setInput('retryLabel', 'Reload');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.error-state-title')?.textContent?.trim()).toBe(
      'Timeline failed',
    );
    expect(fixture.nativeElement.querySelector('.error-state-message')?.textContent?.trim()).toBe(
      'The server is unreachable.',
    );
    expect(
      (fixture.nativeElement.querySelector('.error-state-retry') as HTMLButtonElement)
        .textContent?.trim(),
    ).toBe('Reload');
  });

  it('emits retry when the button is clicked', async () => {
    const fixture = TestBed.createComponent(ErrorState);
    const emitted: unknown[] = [];
    fixture.componentInstance.retry.subscribe((value) => emitted.push(value));
    fixture.detectChanges();
    await fixture.whenStable();

    (fixture.nativeElement.querySelector('.error-state-retry') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(emitted.length).toBe(1);
  });
});
