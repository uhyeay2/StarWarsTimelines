import { computed, Signal } from '@angular/core';

/** @fileoverview Reusable password visibility toggle logic for auth forms. */

export interface PasswordVisibility {
  readonly inputType: Signal<'text' | 'password'>;
  readonly toggleAriaLabel: Signal<string>;
  readonly toggleText: Signal<string>;
}

export function passwordVisibility(show: Signal<boolean>): PasswordVisibility {
  return {
    inputType: computed(() => (show() ? 'text' : 'password')),
    toggleAriaLabel: computed(() => (show() ? 'Hide password' : 'Show password')),
    toggleText: computed(() => (show() ? 'Hide' : 'Show')),
  };
}
