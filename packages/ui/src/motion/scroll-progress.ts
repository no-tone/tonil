/* Smoothed scroll progress - one shared, ref-counted rAF loop.

   Panels and the gradient field both want "how far down the page are we",
   but neither wants it raw: binding straight to scrollY makes motion feel
   welded to the wheel, which reads as mechanical. Instead the published
   `progress` chases the real position exponentially, so it arrives a beat
   late and settles rather than stops.

   Two properties matter and are easy to get wrong:

   - The easing is frame-rate independent. `delta * 0.08` per frame (the
     usual lerp) moves twice as fast at 120Hz as at 60Hz. Solving the
     decay analytically - `1 - exp(-dt / TAU)` - makes 260ms mean 260ms
     on every display.
   - The loop is not always-on. It runs only while there is a gap left to
     close and then lets itself die; the passive scroll listener restarts
     it. A permanent rAF would keep the compositor, and the gradient
     worker downstream of it, awake on a page nobody is touching. */

export interface ScrollState {
  /** Eased 0–1 position through the document. Trails the real position. */
  progress: number;
  /** Raw `window.scrollY`, not smoothed - for anything that must be exact. */
  y: number;
  /** Scrollable distance in px (`scrollHeight - viewport`), 0 if the page fits. */
  max: number;
  /** Viewport height in px. */
  viewport: number;
}

export type ScrollListener = (state: Readonly<ScrollState>) => void;

/** Time constant: ~63% of the remaining gap is closed every TAU_MS. */
export const TAU_MS = 260;
/** Below this gap, snap. Chasing a sub-pixel remainder only burns frames. */
export const EPSILON = 4e-4;
/** A backgrounded tab hands back a multi-second dt; clamp so it eases in. */
export const MAX_FRAME_MS = 250;

/**
 * One step of frame-rate-independent exponential smoothing.
 *
 * Pure and DOM-free so the feel of the motion can be unit-tested directly,
 * which is the whole reason it lives outside the loop below.
 */
export function smoothToward(
  current: number,
  target: number,
  dtMs: number,
  tauMs: number = TAU_MS,
  epsilon: number = EPSILON,
): number {
  const delta = target - current;
  if (delta === 0) return current;
  if (Math.abs(delta) < epsilon) return target;
  return (
    current + delta * (1 - Math.exp(-Math.min(dtMs, MAX_FRAME_MS) / tauMs))
  );
}

const state: ScrollState = { progress: 0, y: 0, max: 0, viewport: 0 };
const listeners = new Set<ScrollListener>();
let stop: (() => void) | null = null;

function emit(): void {
  for (const listener of listeners) listener(state);
}

function start(): () => void {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  let frame = 0;
  let measureFrame = 0;
  let lastFrameAt = -1;

  const measure = (): void => {
    const viewport = window.innerHeight;
    const max = Math.max(0, document.documentElement.scrollHeight - viewport);
    state.viewport = viewport;
    state.max = max;
  };

  const targetProgress = (): number =>
    state.max > 0 ? Math.min(1, Math.max(0, window.scrollY / state.max)) : 0;

  const tick = (now: number): void => {
    frame = 0;
    // First frame of a burst: the loop has been idle, and the document may
    // have changed length while it was - a navigation, a filtered list, a
    // late image, a font swapping in. One layout read per scroll burst is
    // nothing, and it means the scrollable range cannot go stale no matter
    // what a stylesheet does to the boxes the observer watches. That exact
    // coupling is what froze the field after a view transition.
    const wasIdle = lastFrameAt < 0;
    if (wasIdle) measure();
    const dt = wasIdle ? 1000 / 60 : now - lastFrameAt;
    lastFrameAt = now;

    let changed = false;
    if (state.y !== window.scrollY) {
      state.y = window.scrollY;
      changed = true;
    }

    const goal = targetProgress();
    const next = reduced.matches
      ? goal
      : smoothToward(state.progress, goal, dt);
    if (next !== state.progress) {
      state.progress = next;
      changed = true;
    }
    if (changed) emit();

    if (state.progress !== goal) {
      frame = requestAnimationFrame(tick);
    } else {
      lastFrameAt = -1;
    }
  };

  const kick = (): void => {
    if (!frame) frame = requestAnimationFrame(tick);
  };

  // Layout reads are batched into a frame of their own: ResizeObserver can
  // fire several times per resize and `scrollHeight` forces reflow.
  const remeasure = (): void => {
    if (measureFrame) return;
    measureFrame = requestAnimationFrame(() => {
      measureFrame = 0;
      measure();
      kick();
    });
  };

  measure();
  state.y = window.scrollY;
  state.progress = targetProgress();

  const observer = new ResizeObserver(remeasure);
  observer.observe(document.documentElement);
  window.addEventListener("scroll", kick, { passive: true });
  window.addEventListener("resize", remeasure);

  return () => {
    cancelAnimationFrame(frame);
    cancelAnimationFrame(measureFrame);
    observer.disconnect();
    window.removeEventListener("scroll", kick);
    window.removeEventListener("resize", remeasure);
  };
}

/**
 * Subscribe to smoothed scroll progress. Returns an unsubscribe function.
 *
 * The underlying listeners and rAF loop are shared and ref-counted: the
 * first subscriber starts them, the last one to leave tears them down.
 * The listener is called once synchronously with the current state so a
 * caller never has to render an initial frame from a guessed value.
 */
export function subscribeScrollProgress(listener: ScrollListener): () => void {
  listeners.add(listener);
  if (listeners.size === 1) stop = start();
  listener(state);
  return () => {
    if (!listeners.delete(listener)) return;
    if (listeners.size === 0) {
      stop?.();
      stop = null;
    }
  };
}

/** Current state without subscribing. Only meaningful while something is subscribed. */
export function readScrollState(): Readonly<ScrollState> {
  return state;
}
