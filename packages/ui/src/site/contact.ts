/* The reveal controls: a word until you ask for it, then the value types
   itself out, then it copies.

   Three states reached by two clicks, and the click means something different
   in each - which is the point. The first click reveals; the second copies.
   Revealing on hover instead would mean the address is exposed by an
   accidental mouse trajectory, and would do nothing at all on a touch screen.

   There is deliberately no `mailto:`. A mail link hands control to whatever
   the OS thinks the mail client is, which for most people is either nothing
   or the wrong thing - a blank Outlook window is a worse outcome than the
   address on the clipboard. Copying is the action people actually wanted, so
   it is the only action offered.

   The typing is not decoration. The address is the same string you would type
   into a terminal or a To: field, and watching it appear a character at a
   time says that better than fading it in. */

/**
 * Per character.
 *
 * Deliberately slower than a real keystroke. The point is to be *watched* -
 * at 34ms it was over before the eye caught it and just read as a fade.
 */
const TYPE_MS = 72;
const FEEDBACK_MS = 1600;

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function type(target: HTMLElement, text: string): void {
  if (prefersReducedMotion()) {
    target.textContent = text;
    return;
  }
  target.textContent = "";
  let i = 0;
  const step = (): void => {
    target.textContent = text.slice(0, ++i);
    if (i < text.length) window.setTimeout(step, TYPE_MS);
  };
  step();
}

/**
 * Wire up every `[data-copy]` control under `root`.
 *
 * Idempotent: elements already bound are skipped, so this is safe to call
 * after every view transition without stacking listeners.
 */
/**
 * Collapse every other revealed control, so only one is ever expanded.
 *
 * Scoped to the whole document rather than to a parent: the controls share a
 * row, and which row that is belongs to whoever laid them out, not here.
 */
function collapseOthers(current: HTMLElement): void {
  for (const other of document.querySelectorAll<HTMLElement>(
    "[data-copy][data-revealed]",
  )) {
    if (other === current) continue;
    delete other.dataset.revealed;
    delete other.dataset.copied;
    const otherTyped = other.querySelector<HTMLElement>("[data-typed]");
    if (otherTyped) otherTyped.textContent = "";
    const otherBadge = other.querySelector<HTMLElement>("[data-copied-badge]");
    if (otherBadge) otherBadge.textContent = "";
  }
}

export function mountContact(root: ParentNode = document): void {
  for (const el of root.querySelectorAll<HTMLElement>("[data-copy]")) {
    if (el.dataset.contactBound) continue;
    el.dataset.contactBound = "1";

    const address = el.dataset.copy ?? "";
    const typed = el.querySelector<HTMLElement>("[data-typed]");
    const badge = el.querySelector<HTMLElement>("[data-copied-badge]");
    let timer = 0;

    el.addEventListener("click", () => {
      if (!el.dataset.revealed) {
        // One at a time. Two expanded controls do not fit on the row they
        // share - the footer overflowed its column, and on a phone it ran
        // clean off the screen. Collapsing the others is also the honest
        // reading of the interaction: you asked to see *this* one.
        collapseOthers(el);
        el.dataset.revealed = "1";
        if (typed) type(typed, address);
        return;
      }

      // Already revealed, so copy. Best-effort: the clipboard needs a secure
      // context and can be refused, and the address is on screen either way -
      // a failed copy costs the reader nothing but a manual selection.
      if (!address || !badge) return;
      navigator.clipboard
        ?.writeText(address)
        .then(() => {
          badge.textContent = "Copied";
          el.dataset.copied = "1";
          window.clearTimeout(timer);
          timer = window.setTimeout(() => {
            badge.textContent = "";
            delete el.dataset.copied;
          }, FEEDBACK_MS);
        })
        .catch(() => {
          /* Clipboard refused; the address is still on screen to select. */
        });
    });
  }
}
