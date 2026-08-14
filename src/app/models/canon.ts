export const CANON_TIMELINES = ['Canon', 'Legends'] as const;
export type Canon = (typeof CANON_TIMELINES)[number];

export const CANON_VIEWS = ['Canon', 'Legends', 'Canon & Legends'] as const;
export type CanonView = (typeof CANON_VIEWS)[number];

export function matchesCanonView(canon: readonly Canon[], view: CanonView): boolean {
  if (view === 'Canon & Legends') {
    return canon.includes('Canon') && canon.includes('Legends');
  }
  return canon.includes(view);
}
