import { signal } from '@angular/core';
import { passwordVisibility } from './password-visibility';

describe('passwordVisibility', () => {
  it('returns password inputType when show is false', () => {
    const show = signal(false);
    const vis = passwordVisibility(show);
    expect(vis.inputType()).toBe('password');
  });

  it('returns text inputType when show is true', () => {
    const show = signal(true);
    const vis = passwordVisibility(show);
    expect(vis.inputType()).toBe('text');
  });

  it('shows "Show password" aria label when hidden', () => {
    const show = signal(false);
    const vis = passwordVisibility(show);
    expect(vis.toggleAriaLabel()).toBe('Show password');
  });

  it('shows "Hide password" aria label when visible', () => {
    const show = signal(true);
    const vis = passwordVisibility(show);
    expect(vis.toggleAriaLabel()).toBe('Hide password');
  });

  it('shows "Show" toggle text when hidden', () => {
    const show = signal(false);
    const vis = passwordVisibility(show);
    expect(vis.toggleText()).toBe('Show');
  });

  it('shows "Hide" toggle text when visible', () => {
    const show = signal(true);
    const vis = passwordVisibility(show);
    expect(vis.toggleText()).toBe('Hide');
  });

  it('reacts to signal changes', () => {
    const show = signal(false);
    const vis = passwordVisibility(show);

    expect(vis.inputType()).toBe('password');
    expect(vis.toggleAriaLabel()).toBe('Show password');
    expect(vis.toggleText()).toBe('Show');

    show.set(true);

    expect(vis.inputType()).toBe('text');
    expect(vis.toggleAriaLabel()).toBe('Hide password');
    expect(vis.toggleText()).toBe('Hide');

    show.set(false);

    expect(vis.inputType()).toBe('password');
    expect(vis.toggleAriaLabel()).toBe('Show password');
    expect(vis.toggleText()).toBe('Show');
  });
});
