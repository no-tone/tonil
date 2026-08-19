/* Keep swapped-in markup acceptable to the document's original CSP.

   The nonce is per request, and view transitions splice markup from a *new*
   request into a document whose CSP was fixed by the *first* one. Every
   `<style>` ClientRouter carries across therefore arrives stamped with a
   nonce the live document has never heard of, and the browser drops it:

     Refused to apply inline style ... style-src-elem 'nonce-...'

   It only shows on navigation, never on a cold load, which is what makes it
   easy to ship. The blocked elements are the per-page transition-scope
   styles - they differ between pages, so ClientRouter cannot reuse an
   existing one the way it does for the main stylesheet.

   The fix is to restamp them on the way in. The enforced nonce is captured
   once, on first load, from the markup the server sent with the CSP header
   that is actually in force; after a navigation the document contains a
   mixture of nonces and no longer knows which one that was.

   `setAttribute` rather than the `.nonce` property on purpose: HTML says
   changing the nonce content attribute updates the element's internal
   nonce slot, which is what the CSP check reads once it is inserted. */

let enforcedNonce: string | null = null;

function readEnforcedNonce(): string {
  for (const el of document.querySelectorAll<HTMLElement>("style, script")) {
    const nonce = el.nonce;
    if (nonce) return nonce;
  }
  return "";
}

/**
 * Idempotent, and must run before the first navigation - call it from the
 * same boot that mounts everything else.
 *
 * A no-op when there is no nonce to preserve, which is every environment
 * that serves `'unsafe-inline'` (`astro dev`) and any page without a CSP.
 */
export function preserveCspNonce(): void {
  if (enforcedNonce !== null) return;

  enforcedNonce = readEnforcedNonce();
  if (!enforcedNonce) return;
  const nonce = enforcedNonce;

  document.addEventListener("astro:before-swap", (event) => {
    const incoming = (event as Event & { newDocument?: Document }).newDocument;
    if (!incoming) return;
    for (const el of incoming.querySelectorAll("style, script")) {
      if (el.getAttribute("nonce")) el.setAttribute("nonce", nonce);
    }
  });
}
