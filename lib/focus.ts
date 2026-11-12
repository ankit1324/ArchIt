/** Return the next focusable index while keeping keyboard focus inside a dialog. */
export function wrappedFocusIndex(
  itemCount: number,
  currentIndex: number,
  backwards: boolean,
): number {
  if (itemCount <= 0) return -1;
  if (currentIndex < 0 || currentIndex >= itemCount) {
    return backwards ? itemCount - 1 : 0;
  }
  return (currentIndex + (backwards ? -1 : 1) + itemCount) % itemCount;
}

/** Prefer the opener, or a stable fallback if a UI update replaced it. */
export function connectedFocusTarget<T extends { isConnected: boolean }>(
  preferred: T | null,
  fallback: T | null,
): T | null {
  if (preferred?.isConnected) return preferred;
  return fallback?.isConnected ? fallback : null;
}