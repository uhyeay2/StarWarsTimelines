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
