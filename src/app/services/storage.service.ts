/**
 * @fileoverview Abstracted storage service for persisting auth state.
 *
 * Wraps `sessionStorage` to keep tokens and user data scoped to the current
 * browser tab. Data is automatically cleared when the tab is closed, reducing
 * the window of exposure compared to `localStorage`.
 *
 * Inject this service wherever storage access is needed — never call
 * `localStorage` or `sessionStorage` directly.
 */

import { Injectable } from '@angular/core';

/** Storage keys used by the authentication layer. */
export const STORAGE_KEYS = {
  token: 'starwars-timelines.token',
  user: 'starwars-timelines.user',
  refreshToken: 'starwars-timelines.refresh-token',
} as const;

/**
 * Provides a thin, injectable wrapper around `sessionStorage`.
 *
 * Using `sessionStorage` (instead of `localStorage`) means:
 * - Data is scoped to the current tab — other tabs are unaffected.
 * - Data is cleared when the tab is closed.
 * - The same XSS vulnerability window exists (any JS on the page can read it),
 *   but the exposure duration is shorter.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly storage = sessionStorage;

  /**
   * Reads a value from storage.
   *
   * @param key  The storage key.
   * @returns The stored string, or `null` if not present.
   */
  getItem(key: string): string | null {
    return this.storage.getItem(key);
  }

  /**
   * Writes a value to storage.
   *
   * @param key    The storage key.
   * @param value  The string value to store.
   */
  setItem(key: string, value: string): void {
    this.storage.setItem(key, value);
  }

  /**
   * Removes a single key from storage.
   *
   * @param key  The storage key to remove.
   */
  removeItem(key: string): void {
    this.storage.removeItem(key);
  }

  /**
   * Clears all keys from storage.
   *
   * Use with caution — this removes **every** key in `sessionStorage`, not
   * just the application's own keys.
   */
  clear(): void {
    this.storage.clear();
  }
}
