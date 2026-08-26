export const CANON_TIMELINES = ['Canon', 'Legends'] as const;
export type Canon = (typeof CANON_TIMELINES)[number];

/** Re-export from canon-type.ts to avoid duplication of the same values. */
export { CANON_TYPES as CANON_VIEWS } from './canon-type';
/** Canonical source of truth. Import from canon-type.ts for internal use. */
import { CANON_TYPES } from './canon-type';

/** Derived from {@link CANON_VIEWS} — alias for UI filter views. */
export type CanonView = (typeof CANON_TYPES)[number];

export function matchesCanonView(canon: readonly Canon[], view: CanonView): boolean {
  if (view === 'Canon & Legends') {
    return canon.includes('Canon') && canon.includes('Legends');
  }
  return canon.includes(view);
}
