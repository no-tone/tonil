/// <reference lib="webworker" />
/* Renders the gradient field off the main thread.

   Two things make this worth a worker rather than a rAF callback:

   - The pixel loop is O(width × height) of real arithmetic. At full size
     that is millions of `fbm2` calls per frame, and on the main thread it
     would contend with layout and input handling - exactly the work that
     must stay responsive while someone is scrolling.
   - `transferToImageBitmap` hands the result over with no copy. The host
     only ever does a single `drawImage`.

   Frames are capped at 30fps. The field is a slow, soft thing; rendering it
   at display rate would double the cost for motion nobody can see. */

import type { FieldState, HostToWorker, WorkerToHost } from "./field.js";
import { renderField } from "./field.js";
import { deserializeRamp } from "./ramps.js";

const FRAME_MS = 1000 / 30;
/** A tab that was backgrounded hands back a huge delta; don't jump the phase. */
const MAX_STEP_MS = 250;

const scope = self as unknown as DedicatedWorkerGlobalScope;

const canvas = new OffscreenCanvas(2, 2);
let context: OffscreenCanvasRenderingContext2D | null = null;

let state: FieldState | null = null;
let dirty = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let lastRenderAt = -1;
let lastPhaseAt = -1;
let phase = 0;

/**
 * Reused across frames at exactly the current render size.
 *
 * It is tempting to over-allocate and grow geometrically so a resize does not
 * hit the allocator - that is what this used to do, and it was wrong.
 * `renderField` addresses pixels at stride `width`, while `putImageData`
 * reads at the ImageData's own stride, so the moment the buffer was wider
 * than the frame the two disagreed and every shrink produced a sheared,
 * mostly-empty field that then stuck. An exact-size buffer makes the two
 * strides the same by construction. The cost is one allocation per *distinct*
 * size, which is what a resize actually is.
 */
let buffer: ImageData | null = null;
let bufferWidth = 0;
let bufferHeight = 0;

function post(message: WorkerToHost, transfer: Transferable[] = []): void {
  scope.postMessage(message, transfer);
}

function ensureBuffer(
  ctx: OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
): ImageData {
  if (!buffer || width !== bufferWidth || height !== bufferHeight) {
    bufferWidth = width;
    bufferHeight = height;
    buffer = ctx.createImageData(width, height);
  }
  return buffer;
}

/** Only worth re-rendering on a timer when something actually moves by itself. */
function isAnimating(current: FieldState | null): boolean {
  return !!current?.visible && current.wave > 0 && !current.reducedMotion;
}

function render(current: FieldState): void {
  if (!context) {
    context = canvas.getContext("2d");
    if (!context) throw new Error("OffscreenCanvas 2D context unavailable");
  }

  const { width, height, renderScale } = current;
  if (!width || !height) return;

  const scale = Math.min(1, Math.max(0.1, renderScale));
  const renderWidth = Math.max(2, Math.round(width * scale));
  const renderHeight = Math.max(2, Math.round(height * scale));
  if (canvas.width !== renderWidth) canvas.width = renderWidth;
  if (canvas.height !== renderHeight) canvas.height = renderHeight;

  const image = ensureBuffer(context, renderWidth, renderHeight);
  const profile = renderField(image.data, {
    width: renderWidth,
    height: renderHeight,
    aspect: width / height,
    ramp: deserializeRamp(current.ramp),
    frequency: current.frequency,
    warp: current.warp,
    travel: current.travel,
    angle: current.angle,
    progress: current.progress,
    phase,
    loop: current.loop,
  });

  context.putImageData(image, 0, 0);
  const bitmap = canvas.transferToImageBitmap();
  post(
    {
      type: "frame",
      bitmap,
      width,
      height,
      dpr: current.dpr,
      progress: current.progress,
      profile: new Int16Array(profile),
    },
    [bitmap],
  );
}

function tick(): void {
  timer = null;
  const current = state;
  if (!current?.visible) {
    lastRenderAt = -1;
    lastPhaseAt = -1;
    return;
  }

  const now = performance.now();
  lastRenderAt = now;

  if (isAnimating(current)) {
    if (lastPhaseAt >= 0) {
      phase += (Math.min(now - lastPhaseAt, MAX_STEP_MS) / 1000) * current.wave;
    }
    lastPhaseAt = now;
  } else {
    lastPhaseAt = -1;
  }

  if (dirty || isAnimating(current)) {
    dirty = false;
    try {
      render(current);
    } catch (error) {
      post({
        type: "error",
        message: error instanceof Error ? error.message : String(error),
      });
      return;
    }
  }

  if (dirty || isAnimating(state)) schedule();
}

function schedule(): void {
  if (timer !== null || !state?.visible) return;
  const elapsed =
    lastRenderAt < 0 ? FRAME_MS : performance.now() - lastRenderAt;
  timer = setTimeout(tick, Math.max(0, FRAME_MS - elapsed));
}

scope.onmessage = ({ data }: MessageEvent<HostToWorker>) => {
  state = data.state;
  dirty = true;
  if (!state.visible) {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    lastRenderAt = -1;
    lastPhaseAt = -1;
    return;
  }
  schedule();
};
