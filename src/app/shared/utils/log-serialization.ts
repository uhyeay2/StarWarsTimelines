/**
 * @fileoverview Safe serialization utilities for log output.
 *
 * Provides depth-limited, string-truncated serialization that handles
 * circular references, `BigInt`, `Symbol`, `Function`, `Error`, arrays,
 * and plain objects.
 */

/**
 * Recursively serializes a value with depth and string-length limits.
 *
 * Handles circular references, `BigInt`, `Symbol`, `Function`, `Error`,
 * arrays, and plain objects. Values exceeding `maxDepth` are replaced
 * with `'[Depth limit exceeded]'`. Strings longer than `maxStringLength`
 * are truncated with `'...'`.
 *
 * @param value           The value to serialize.
 * @param maxDepth        Maximum recursion depth.
 * @param maxStringLength Maximum string length before truncation.
 * @param depth           Current recursion depth (used internally).
 * @param seen            Set of already-visited objects (for circular detection).
 * @returns A safe, serializable representation of the value.
 */
export function safeSerialize(
  value: unknown,
  maxDepth: number,
  maxStringLength: number,
  depth = 0,
  seen?: WeakSet<object>,
): unknown {
  if (depth > maxDepth) return '[Depth limit exceeded]';
  if (value === null) return null;
  if (value === undefined) return '[undefined]';

  const type = typeof value;

  if (type === 'bigint') return `${value}n`;
  if (type === 'symbol') return value.toString();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- checking for function type in serialization
  if (type === 'function') return `[Function: ${(value as Function).name || 'anonymous'}]`;

  if (type === 'string') {
    const str = value as string;
    return str.length > maxStringLength ? str.slice(0, maxStringLength) + '...' : str;
  }

  if (type === 'number' || type === 'boolean') return value;

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack?.split('\n').slice(0, 5).join('\n'),
    };
  }

  if (typeof value === 'object') {
    if (!seen) seen = new WeakSet();
    if (seen.has(value as object)) return '[Circular]';
    seen.add(value as object);

    if (Array.isArray(value)) {
      return value.map((item) => safeSerialize(item, maxDepth, maxStringLength, depth + 1, seen));
    }

    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = safeSerialize(val, maxDepth, maxStringLength, depth + 1, seen);
    }
    return result;
  }

  return String(value);
}
