/**
 * Immutable Set helpers for signal-backed state such as expand/collapse
 * tracking. Each helper returns a new Set, matching the update semantics
 * expected by Angular signals.
 */

export function addedTo<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  next.add(value);
  return next;
}

export function removedFrom<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  next.delete(value);
  return next;
}

export function toggledIn<T>(set: ReadonlySet<T>, value: T): Set<T> {
  return set.has(value) ? removedFrom(set, value) : addedTo(set, value);
}

/** Builds an updater that drops every key starting with `prefix`. */
export function removedWithPrefix(prefix: string): (set: ReadonlySet<string>) => Set<string> {
  return (set) => {
    const next = new Set(set);
    for (const key of next) {
      if (key.startsWith(prefix)) {
        next.delete(key);
      }
    }
    return next;
  };
}
