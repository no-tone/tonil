/* A custom right-click menu.

   Overriding the browser's context menu is usually a hostile thing to do, so
   this only does it where it costs the reader nothing:

   - Shift + right-click always yields the native menu. That is the escape
     hatch every site that replaces this control should have, and it is the
     one people already know.
   - A right-click inside a text field, or with text selected, is left alone
     entirely. That is where the native menu is genuinely load-bearing -
     spellcheck, undo, copy-this-selection - and no bespoke menu is going to
     do better.

   What is left is the right-click on empty page, which normally offers
   "Reload" and "View source" and nothing anybody wanted. That is the one this
   takes over.

   The markup is rendered by ContextMenu.astro and is inert without this; the
   items are plain links and buttons, so worst case they are a hidden list. */

/** Distance kept between the menu and the viewport edge. */
const EDGE_MARGIN = 8;
/** How long a copied item shows its confirmation before the menu closes. */
const COPIED_MS = 620;

let menu: HTMLElement | null = null;
let bound = false;
/** Focus is returned here on close, so a keyboard user is not dropped at the top. */
let restoreFocusTo: Element | null = null;

function items(): HTMLElement[] {
  if (!menu) return [];
  return Array.from(menu.querySelectorAll<HTMLElement>("[role='menuitem']"));
}

function focusItem(index: number): void {
  const list = items();
  if (list.length === 0) return;
  // Wrap: a menu is a ring, and running off the end of one is an error state
  // the reader has to notice and correct.
  const target = list[((index % list.length) + list.length) % list.length];
  target?.focus();
}

function isOpen(): boolean {
  return !!menu && !menu.hidden;
}

function close(restoreFocus = true): void {
  if (!menu || menu.hidden) return;
  menu.hidden = true;
  menu.removeAttribute("data-open");
  if (restoreFocus && restoreFocusTo instanceof HTMLElement) {
    restoreFocusTo.focus({ preventScroll: true });
  }
  restoreFocusTo = null;
}

function open(x: number, y: number): void {
  if (!menu) return;
  restoreFocusTo = document.activeElement;

  // Unhide before measuring: a `hidden` element has no box, so the clamp
  // below would have nothing to clamp against.
  menu.hidden = false;
  menu.style.left = "0px";
  menu.style.top = "0px";
  const { width, height } = menu.getBoundingClientRect();

  // Prefer the pointer, but never past the edge - and clamp the near side
  // last so a menu taller than the viewport still starts on screen.
  const left = Math.max(
    EDGE_MARGIN,
    Math.min(x, window.innerWidth - width - EDGE_MARGIN),
  );
  const top = Math.max(
    EDGE_MARGIN,
    Math.min(y, window.innerHeight - height - EDGE_MARGIN),
  );
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  menu.setAttribute("data-open", "");
  focusItem(0);
}

function copy(item: HTMLElement, value: string): void {
  const label = item.querySelector<HTMLElement>("[data-ctx-label]");
  const previous = label?.textContent ?? "";
  navigator.clipboard
    ?.writeText(value)
    .then(() => {
      if (label) label.textContent = "copied";
      item.setAttribute("data-copied", "");
      window.setTimeout(() => {
        if (label) label.textContent = previous;
        item.removeAttribute("data-copied");
        close();
      }, COPIED_MS);
    })
    .catch(() => close());
}

function onContextMenu(event: MouseEvent): void {
  if (!menu) return;
  // The escape hatch, and the two places the native menu earns its keep.
  if (event.shiftKey) return;
  // `instanceof Element` rather than a cast: the target of a contextmenu
  // event is not always an element - raised on the document itself it is the
  // Document, which has no `closest` and would throw here, killing the
  // handler with nothing to show for it.
  const target = event.target;
  if (
    target instanceof Element &&
    target.closest(
      "input, textarea, select, [contenteditable=''], [contenteditable='true']",
    )
  ) {
    return;
  }
  if (!window.getSelection()?.isCollapsed) return;

  event.preventDefault();
  // The context-menu key and Shift+F10 fire this with no useful coordinates;
  // anchor to whatever has focus instead of pinning the menu to the corner.
  if (event.clientX === 0 && event.clientY === 0) {
    const anchor = document.activeElement ?? document.body;
    const rect = anchor.getBoundingClientRect();
    open(rect.left, rect.bottom);
    return;
  }
  open(event.clientX, event.clientY);
}

function onKeyDown(event: KeyboardEvent): void {
  if (!isOpen()) return;
  const list = items();
  const index = list.indexOf(document.activeElement as HTMLElement);

  switch (event.key) {
    case "Escape":
      event.preventDefault();
      close();
      break;
    case "ArrowDown":
      event.preventDefault();
      focusItem(index + 1);
      break;
    case "ArrowUp":
      event.preventDefault();
      focusItem(index - 1);
      break;
    case "Home":
      event.preventDefault();
      focusItem(0);
      break;
    case "End":
      event.preventDefault();
      focusItem(list.length - 1);
      break;
    case "Tab":
      // Tabbing out of a menu means leaving it, not walking it.
      close(false);
      break;
    default:
      break;
  }
}

function onPointerDown(event: PointerEvent): void {
  if (!isOpen() || !menu) return;
  if (event.target instanceof Node && menu.contains(event.target)) return;
  close(false);
}

function onMenuClick(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const item = target.closest<HTMLElement>("[role='menuitem']");
  if (!item) return;

  const value = item.dataset.ctxCopy;
  if (value === undefined) {
    // A link: let the navigation happen and get out of its way.
    close(false);
    return;
  }
  event.preventDefault();
  copy(item, value);
}

/**
 * Bind the menu rendered by ContextMenu.astro.
 *
 * Idempotent, and safe to call after every view transition: the document
 * listeners are attached once at module scope, while the element itself is
 * re-resolved each time because a navigation replaces it.
 */
export function mountContextMenu(root: ParentNode = document): void {
  const next = root.querySelector<HTMLElement>("[data-context-menu]");
  if (!next) return;
  menu = next;
  menu.hidden = true;
  // A navigation hands us a brand new element, but a re-mount on the same
  // page hands us the one we already bound - and must not stack a second
  // handler on it.
  if (!menu.dataset.ctxBound) {
    menu.dataset.ctxBound = "1";
    menu.addEventListener("click", onMenuClick);
  }

  if (bound) return;
  bound = true;
  document.addEventListener("contextmenu", onContextMenu);
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("pointerdown", onPointerDown);
  // Anything that moves the page out from under a pinned element closes it:
  // the menu is anchored to a point that no longer means anything.
  window.addEventListener("resize", () => close(false));
  window.addEventListener("scroll", () => close(false), { passive: true });
  window.addEventListener("blur", () => close(false));
}
