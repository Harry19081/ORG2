export const RECENT_TABS_LIMIT = 5;

interface TabIdentity {
  id: string;
}

/** Put one tab at the front of a bounded, de-duplicated MRU history. */
export function recordRecentTab<T extends TabIdentity>(
  current: readonly T[],
  tab: T
): T[] {
  return recordRecentItem(current, tab, (left, right) => left.id === right.id);
}

/** Identity belongs to the surface; ordering and the retention bound are shared. */
export function recordRecentItem<T>(
  current: readonly T[],
  item: T,
  isSame: (left: T, right: T) => boolean
): T[] {
  return [
    item,
    ...current.filter((candidate) => !isSame(candidate, item)),
  ].slice(0, RECENT_TABS_LIMIT);
}

/** Remove the destination and remember the eligible item being left. */
export function recordRecentTransition<T>(
  current: readonly T[],
  previous: T | null | undefined,
  isDestination: (item: T) => boolean,
  canRecord: (item: T) => boolean,
  isSame: (left: T, right: T) => boolean
): T[] {
  const remaining = current.filter((item) => !isDestination(item));
  return previous && !isDestination(previous) && canRecord(previous)
    ? recordRecentItem(remaining, previous, isSame)
    : remaining;
}

export function removeRecentTab<T extends TabIdentity>(
  current: readonly T[],
  tabId: string
): T[] {
  return current.filter((tab) => tab.id !== tabId);
}
