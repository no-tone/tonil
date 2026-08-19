import { describe, expect, it } from "vitest";
import {
  type FieldParams,
  PROFILE_ROWS,
  renderField,
  renderGrainTile,
} from "../src/gradient/field.js";
import { hexToRgb } from "../src/gradient/oklab.js";
import { type Ramp, signatureRamp } from "../src/gradient/ramps.js";

const RAMP: Ramp = signatureRamp(hexToRgb("#4d8dff"));

function params(overrides: Partial<FieldParams> = {}): FieldParams {
  return {
    width: 32,
    height: 32,
    aspect: 1,
    ramp: RAMP,
    frequency: 1.5,
    warp: 0.34,
    travel: 1,
    angle: 90,
    progress: 0,
    phase: 0,
    loop: false,
    ...overrides,
  };
}

function render(overrides: Partial<FieldParams> = {}) {
  const p = params(overrides);
  const buffer = new Uint8ClampedArray(p.width * p.height * 4);
  const profile = renderField(buffer, p);
  return { buffer, profile, params: p };
}

function pixel(buffer: Uint8ClampedArray, width: number, x: number, y: number) {
  const i = (y * width + x) * 4;
  return [buffer[i], buffer[i + 1], buffer[i + 2], buffer[i + 3]];
}

describe("renderField", () => {
  it("fills every pixel opaque", () => {
    const { buffer } = render();
    for (let i = 3; i < buffer.length; i += 4) expect(buffer[i]).toBe(255);
  });

  it("is deterministic - the same params give byte-identical output", () => {
    // Resizes and re-renders must land on the same field, not reshuffle it.
    expect(render().buffer).toEqual(render().buffer);
  });

  it("refuses a target that is not exactly the frame's size", () => {
    // Regression guard. The worker used to hand this an over-allocated,
    // geometrically-grown buffer to avoid reallocating on resize. Pixels are
    // written at stride `width` and read back at the buffer's own stride, so
    // every time the field *shrank* the two disagreed and the frame came out
    // sheared - visible as a near-black rail the moment you narrowed the
    // window past the mobile breakpoint. Failing loudly is the fix.
    const p = params({ width: 8, height: 8 });
    expect(() => renderField(new Uint8ClampedArray(16 * 8 * 4), p)).toThrow(
      RangeError,
    );
    expect(() => renderField(new Uint8ClampedArray(4 * 8 * 4), p)).toThrow(
      RangeError,
    );
  });

  it("runs light-to-dark down the default 90° axis", () => {
    // The ramp climbs in lightness, and the axis runs top to bottom, so the
    // bottom of the field must be brighter than the top.
    const { buffer, params: p } = render();
    const top = pixel(buffer, p.width, 16, 0);
    const bottom = pixel(buffer, p.width, 16, p.height - 1);
    const sum = (c: (number | undefined)[]) =>
      (c[0] ?? 0) + (c[1] ?? 0) + (c[2] ?? 0);
    expect(sum(bottom)).toBeGreaterThan(sum(top));
  });

  it("moves the field when progress advances", () => {
    expect(render({ progress: 0 }).buffer).not.toEqual(
      render({ progress: 0.6 }).buffer,
    );
  });

  it("moves the field when phase advances", () => {
    // Without this the `wave` drift would be inert and the panel would sit
    // dead still whenever nobody scrolls.
    expect(render({ phase: 0 }).buffer).not.toEqual(
      render({ phase: 4 }).buffer,
    );
  });

  it("produces a flat axis-aligned field when warp is zero", () => {
    // No displacement means every pixel in a row shares a value; any
    // variation across x would mean the axis projection is wrong.
    const { buffer, params: p } = render({ warp: 0, angle: 90 });
    for (let y = 0; y < p.height; y++) {
      const first = pixel(buffer, p.width, 0, y);
      for (let x = 1; x < p.width; x++) {
        const here = pixel(buffer, p.width, x, y);
        // Only the anti-banding dither separates them. It spans ~0.006 of
        // the ramp, which across an ~200-level ramp is one or two 8-bit
        // steps once rounded - visible as grain, never as structure.
        expect(Math.abs((here[0] ?? 0) - (first[0] ?? 0))).toBeLessThanOrEqual(
          2,
        );
      }
    }
  });

  it("rotates with angle", () => {
    expect(render({ angle: 90, warp: 0 }).buffer).not.toEqual(
      render({ angle: 0, warp: 0 }).buffer,
    );
  });

  it("keeps every sample inside the ramp when clamping", () => {
    // Noise displacement can push t outside 0–1; if the clamp were missing
    // sampleRamp would still cope, but loop mode's modulo would not.
    const { buffer } = render({ warp: 1, travel: 1 });
    for (let i = 0; i < buffer.length; i += 4) {
      expect(buffer[i]).toBeGreaterThanOrEqual(0);
      expect(buffer[i]).toBeLessThanOrEqual(255);
    }
  });

  it("does not produce NaN in loop mode", () => {
    const { buffer } = render({ loop: true, travel: 1 });
    for (let i = 0; i < buffer.length; i += 4) {
      expect(Number.isFinite(buffer[i])).toBe(true);
    }
  });

  it("survives travel: 0 without dividing by zero", () => {
    const { buffer } = render({ loop: true, travel: 0 });
    for (let i = 3; i < buffer.length; i += 4) expect(buffer[i]).toBe(255);
  });
});

describe("frame profile", () => {
  it("reports one RGB triple per band", () => {
    const { profile } = render();
    expect(profile).toHaveLength(PROFILE_ROWS * 3);
  });

  it("averages the actual rows it claims to", () => {
    // Band 0 is the top row and the last band is the bottom row; check the
    // reported average against the buffer directly.
    const { buffer, profile, params: p } = render();
    for (const [band, row] of [
      [0, 0],
      [PROFILE_ROWS - 1, p.height - 1],
    ] as const) {
      let total = 0;
      for (let x = 0; x < p.width; x++)
        total += buffer[(row * p.width + x) * 4] ?? 0;
      expect(profile[band * 3]).toBe(Math.round(total / p.width));
    }
  });

  it("climbs with the field", () => {
    const { profile } = render();
    const first = profile[0] ?? 0;
    const last = profile[(PROFILE_ROWS - 1) * 3] ?? 0;
    expect(last).not.toBe(first);
  });

  it("reuses a caller-supplied buffer without leaking the previous frame", () => {
    const p = params();
    const buffer = new Uint8ClampedArray(p.width * p.height * 4);
    const shared = new Int16Array(PROFILE_ROWS * 3).fill(999);
    renderField(buffer, p, shared);
    expect(Array.from(shared).some((v) => v === 999)).toBe(false);
  });
});

describe("renderGrainTile", () => {
  it("fills an opaque monochrome tile", () => {
    const size = 16;
    const tile = new Uint8ClampedArray(size * size * 4);
    renderGrainTile(tile, size, 80);
    for (let i = 0; i < tile.length; i += 4) {
      expect(tile[i]).toBe(tile[i + 1]);
      expect(tile[i + 1]).toBe(tile[i + 2]);
      expect(tile[i + 3]).toBe(255);
    }
  });

  it("centres on mid-grey and respects depth", () => {
    const size = 32;
    const tile = new Uint8ClampedArray(size * size * 4);
    renderGrainTile(tile, size, 80);
    let total = 0;
    let min = 255;
    let max = 0;
    for (let i = 0; i < tile.length; i += 4) {
      const v = tile[i] ?? 0;
      total += v;
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
    expect(total / (size * size)).toBeCloseTo(128, -1);
    expect(min).toBeGreaterThanOrEqual(48);
    expect(max).toBeLessThanOrEqual(208);
  });

  it("goes flat at depth 0", () => {
    const size = 8;
    const tile = new Uint8ClampedArray(size * size * 4);
    renderGrainTile(tile, size, 0);
    for (let i = 0; i < tile.length; i += 4) expect(tile[i]).toBe(128);
  });
});
