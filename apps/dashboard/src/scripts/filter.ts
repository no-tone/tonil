/**
 * Pure search/tag filtering logic for the app tiles, extracted from
 * main-menu's inline index.astro script so it can be unit tested.
 */
interface FilterableTile {
  name: string;
  /** Comma-joined tag string, e.g. "Ops,Network,Self-Hosted". */
  tags: string;
}

export function matchesFilter(
  tile: FilterableTile,
  query: string,
  tag: string,
): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedTag = tag.trim();
  const nameMatches =
    !normalizedQuery || tile.name.toLowerCase().includes(normalizedQuery);
  const tagMatches = !normalizedTag || tile.tags.includes(normalizedTag);
  return nameMatches && tagMatches;
}
