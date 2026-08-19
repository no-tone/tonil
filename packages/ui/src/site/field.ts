/* One gradient field, shared across navigations - and across apps.

   The field element carries `transition:persist`, so Astro's view transitions
   keep the DOM node across a page change - but the *scripts* on the new page
   run again. Mounting a second time would spawn a second worker on top of a
   canvas already owned by the first.

   So the handle lives at module scope and mount is idempotent. Each route
   declares its palette on `<body data-ramp>`; this reads it after every
   navigation and cross-fades. The field never restarts, which is the whole
   point: it should feel like the page changed *around* something continuous,
   not like everything was thrown away and rebuilt. */

import {
  mountNoiseGradient,
  type NoiseGradientHandle,
  RAMPS,
  type RampId,
  rowsToCss,
} from "../gradient/index.js";
import { subscribeScrollProgress } from "../motion/scroll-progress.js";

let handle: NoiseGradientHandle | null = null;

/**
 * Paint the wordmark's backslash from the frame's colour bands.
 *
 * The mark is the one stroke in the logo that goes against the grain, so it
 * is also the one that carries the field's colour - the same relationship the
 * accent text has, expressed in SVG. CSS `background-clip` cannot do this on
 * a path, so the wordmark ships a <linearGradient> whose stops are written
 * here.
 *
 * The stop list is cached: it is the same 25 nodes every frame, and querying
 * for them 30 times a second would be the most expensive thing on the page.
 */
let markStops: SVGStopElement[] | null = null;

function paintMark(profile: Int16Array): void {
  if (!markStops) {
    markStops = Array.from(
      document.querySelectorAll<SVGStopElement>("#ntl-ramp stop"),
    );
    if (markStops.length === 0) return;
  }
  for (const [i, stop] of markStops.entries()) {
    const r = profile[i * 3] ?? 255;
    const g = profile[i * 3 + 1] ?? 255;
    const b = profile[i * 3 + 2] ?? 255;
    stop.setAttribute("stop-color", `rgb(${r} ${g} ${b})`);
  }
}

function currentRamp(): RampId {
  const declared = document.body.dataset.ramp;
  return declared && declared in RAMPS ? (declared as RampId) : "moss";
}

/**
 * Mount the field if it is not already running, then apply this page's ramp.
 *
 * The only thing that varies between pages is the palette, and that comes
 * from `<body data-ramp>` on every call. Everything else is the same field
 * everywhere on purpose: it is the one element both properties share, and a
 * per-page knob would be an invitation for them to drift.
 */
export function syncField(): void {
  const host = document.querySelector<HTMLElement>("[data-gradient-panel]");
  if (!host) return;

  if (!handle) {
    handle = mountNoiseGradient(host, {
      ramp: currentRamp(),
      onFrame: ({ profile }) => {
        // The accent text is filled from the colours on screen this frame, so
        // it tracks the palette change for free.
        //
        // `style.setProperty`, never `setAttribute("style", …)`. The two look
        // interchangeable and are not: CSP governs the style *attribute* and
        // does not govern the CSSOM, so under this site's production policy
        // (`style-src 'self' 'nonce-…'`, no unsafe-inline) the second form is
        // dropped silently. Local dev serves 'unsafe-inline', so the swap
        // would pass every test you could run here and only break once
        // deployed. See docs/engineering.md.
        document.documentElement.style.setProperty(
          "--field-ramp",
          rowsToCss(profile),
        );
        paintMark(profile);
      },
    });
    // Never unsubscribed on purpose: the field is a page-lifetime singleton
    // that survives every navigation, so the subscription should outlive them
    // too. Tearing it down and re-adding it per route would be churn for a
    // listener that is meant to be permanent.
    subscribeScrollProgress(({ progress }) => handle?.update({ progress }));
    return;
  }

  // The shell is re-rendered on navigation, so last route's stop nodes are
  // detached. Drop the cache and let the next frame re-resolve them.
  markStops = null;
  handle.update({ ramp: currentRamp() });
}
