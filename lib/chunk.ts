/**
 * Split `items` into consecutive groups of `size` (the last may be shorter).
 * Used to keep `.in()` filters short: PostgREST puts every id in the request
 * URL, and a few hundred uuids is enough to hit proxy URL-length limits.
 */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) {
    throw new RangeError(`chunk size must be a positive integer, got ${size}`);
  }
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
