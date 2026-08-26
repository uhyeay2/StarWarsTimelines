/**
 * @fileoverview Pure text-search utilities for filtering collections by
 * case-insensitive substring match on a `name` property.
 */
/**
 * Filters items by case-insensitive substring match on their `name`.
 * An empty or whitespace-free search term returns the input untouched.
 */
export function filterByName<T extends { name: string }>(
  items: readonly T[],
  searchTerm: string,
): readonly T[] {
  const term = searchTerm.toLowerCase();
  if (!term) {
    return items;
  }
  return items.filter((item) => item.name.toLowerCase().includes(term));
}
