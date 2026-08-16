export const CANON_TYPES = ['Canon', 'Legends', 'Canon & Legends'] as const;

export type CanonType = (typeof CANON_TYPES)[number];

export function canonTypeFromApiCode(code: number): CanonType {
  const canonType = CANON_TYPES[code];
  if (canonType === undefined) {
    throw new Error(`Unknown canon type code: ${code}`);
  }
  return canonType;
}
