/* Drag-to-rotate/tilt interaction for the WebGL globe: hit-testing against
   the sphere's on-screen circle, a small movement threshold before a click
   turns into a drag, and the rotate/tilt update itself. The math is pure
   (and unit-tested); `bindGlobeDrag` is the thin DOM-wiring half that tracks
   pointer events on `window` so a drag survives the pointer crossing
   nodes/chrome. */

const ROTATE_SPEED = 0.006;
const TILT_SPEED = 0.004;
export const TILT_LIMIT = 1.25;
const DRAG_MOVE_THRESHOLD = 4;

interface Point {
  x: number;
  y: number;
}

/** Is `point` within the sphere's hit-circle (radius scaled by a small
 *  tolerance, matching the original hand-tuned 1.05 factor)? */
export function isWithinHitRadius(
  point: Point,
  center: Point,
  radius: number,
): boolean {
  return Math.hypot(point.x - center.x, point.y - center.y) <= radius * 1.05;
}

/** Has the pointer moved far enough from its down-position to count as a
 *  drag rather than a click? */
export function exceedsDragThreshold(dx: number, dy: number): boolean {
  return Math.abs(dx) + Math.abs(dy) >= DRAG_MOVE_THRESHOLD;
}

/** Given the current rotation/tilt and a pointer-movement delta, returns the
 *  next rotation/tilt (tilt clamped to +/- TILT_LIMIT). */
export function applyDragDelta(
  rot: number,
  tilt: number,
  dx: number,
  dy: number,
): { rot: number; tilt: number } {
  return {
    rot: rot + dx * ROTATE_SPEED,
    tilt: Math.max(-TILT_LIMIT, Math.min(TILT_LIMIT, tilt - dy * TILT_SPEED)),
  };
}

export interface DragState {
  rot: number;
  tilt: number;
  dragging: boolean;
}

interface BindGlobeDragOptions {
  element: HTMLElement;
  getCenter: () => Point;
  getRadius: () => number;
  getState: () => DragState;
  onChange: (next: DragState) => void;
}

/** Wires pointer-drag rotate/tilt onto `element`. Returns a detach function. */
export function bindGlobeDrag(opts: BindGlobeDragOptions): () => void {
  const { element, getCenter, getRadius, getState, onChange } = opts;
  let lx = 0;
  let ly = 0;
  let downX = 0;
  let downY = 0;
  let active = false;

  const onDown = (e: PointerEvent) => {
    const rect = element.getBoundingClientRect();
    const point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    if (!isWithinHitRadius(point, getCenter(), getRadius())) return;
    active = true;
    lx = downX = e.clientX;
    ly = downY = e.clientY;
  };
  const onMove = (e: PointerEvent) => {
    if (!active) return;
    const state = getState();
    let dragging = state.dragging;
    if (!dragging) {
      if (!exceedsDragThreshold(e.clientX - downX, e.clientY - downY)) return;
      dragging = true;
    }
    const { rot, tilt } = applyDragDelta(
      state.rot,
      state.tilt,
      e.clientX - lx,
      e.clientY - ly,
    );
    onChange({ rot, tilt, dragging });
    lx = e.clientX;
    ly = e.clientY;
  };
  const onUp = () => {
    active = false;
    onChange({ ...getState(), dragging: false });
  };

  element.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);

  return () => {
    element.removeEventListener("pointerdown", onDown);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
  };
}
