/* Filtering a list in the page: a text query, an optional tag, a live count.

   Both the launcher and the work list are the same interaction - type to
   narrow, pick a tag to narrow further, be told how many are left - so it is
   one implementation rather than two that will drift.

   The matching is pure and the DOM wiring is a thin shell around it. That
   split is the reason this is testable at all: `matchesFilter` is where every
   decision is made, and `mountFilter` only reads attributes and toggles
   `hidden`.

   Items declare themselves with data attributes rather than being passed in
   as a list, so the markup stays the source of truth and a server-rendered
   page needs no hydration payload:

     <li data-filter-item data-name="grafana" data-tags="Ops,Monitoring">
*/

export interface FilterableItem {
  name: string;
  /** Comma-joined tags, e.g. `Ops,Network,Self-Hosted`. */
  tags: string;
}

/** Whether an item survives the current query and tag. */
export function matchesFilter(
  item: FilterableItem,
  query: string,
  tag: string,
): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedTag = tag.trim();
  const nameMatches =
    !normalizedQuery || item.name.toLowerCase().includes(normalizedQuery);
  const tagMatches = !normalizedTag || item.tags.includes(normalizedTag);
  return nameMatches && tagMatches;
}

/* The markup contract, fixed rather than configurable.

   These were options once, six of them, and both callers took every default.
   Configurable selectors would mean the data attributes are not really the
   contract - and they are: a page opts in by labelling its markup, not by
   passing a shape that describes its markup from somewhere else. */
const ITEM = "[data-filter-item]";
const SEARCH = "[data-filter-search]";
const TAG = "[data-filter-tag]";
const COUNT = "[data-filter-count]";
const EMPTY = "[data-filter-empty]";
/** Focuses the search box, the way it does almost everywhere else. */
const FOCUS_KEY = "/";

/**
 * Wire up the controls under `root`. Returns the number of items found, so a
 * caller can tell "no filter on this page" from "a filter that matched
 * nothing" - otherwise a typo in a selector is silent.
 *
 * Idempotent: bound elements are skipped, so this is safe to call after every
 * view transition.
 */
export function mountFilter(root: ParentNode = document): number {
  const items = Array.from(root.querySelectorAll<HTMLElement>(ITEM));
  if (items.length === 0) return 0;

  const search = root.querySelector<HTMLInputElement>(SEARCH);
  const tagPicker = root.querySelector<HTMLSelectElement>(TAG);
  const count = root.querySelector<HTMLElement>(COUNT);
  const empty = root.querySelector<HTMLElement>(EMPTY);

  const apply = (): void => {
    const query = search?.value ?? "";
    const tag = tagPicker?.value ?? "";
    let visible = 0;
    for (const item of items) {
      const show = matchesFilter(
        { name: item.dataset.name ?? "", tags: item.dataset.tags ?? "" },
        query,
        tag,
      );
      item.hidden = !show;
      if (show) visible++;
    }
    if (count) count.textContent = `${visible} / ${items.length}`;
    if (empty) empty.hidden = visible !== 0;
  };

  if (search && !search.dataset.filterBound) {
    search.dataset.filterBound = "1";
    search.addEventListener("input", apply);
  }
  if (tagPicker && !tagPicker.dataset.filterBound) {
    tagPicker.dataset.filterBound = "1";
    tagPicker.addEventListener("change", apply);
  }

  if (search && !search.dataset.filterKeyBound) {
    search.dataset.filterKeyBound = "1";
    document.addEventListener("keydown", (event) => {
      if (event.key !== FOCUS_KEY) return;
      // Not while someone is typing somewhere else - "/" is a character
      // before it is a shortcut.
      const active = document.activeElement;
      if (
        active === search ||
        (active instanceof HTMLElement &&
          (active.isContentEditable ||
            ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName)))
      ) {
        return;
      }
      event.preventDefault();
      search.focus();
    });
  }

  apply();
  return items.length;
}
