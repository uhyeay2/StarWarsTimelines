export const MEDIA = [
  'Movie',
  'Book',
  'Comic',
  'Animated Show',
  'Live Action Show',
  'Video Game',
  'Short Film',
] as const;

export type Medium = (typeof MEDIA)[number];

export function mediumFromApiCode(code: number): Medium {
  const medium = MEDIA[code];
  if (medium === undefined) {
    throw new Error(`Unknown medium code: ${code}`);
  }
  return medium;
}
