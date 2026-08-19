import { describe, expect, it } from "vitest";
import {
  EPSILON,
  MAX_FRAME_MS,
  smoothToward,
  TAU_MS,
} from "../src/motion/scroll-progress.js";

describe("smoothToward", () => {
  it("closes ~63% of the gap in one time constant", () => {
    // The defining property of exponential decay: after one tau, 1/e of the
    // gap remains. Asserted with a tau under MAX_FRAME_MS, because the
    // default TAU_MS (260) is above the frame clamp (250) - no single real
    // frame is ever long enough to complete one time constant.
    expect(smoothToward(0, 1, 100, 100)).toBeCloseTo(1 - Math.exp(-1), 12);
  });

  it("never lets one frame advance more than the clamp allows", () => {
    expect(TAU_MS).toBeGreaterThan(MAX_FRAME_MS);
    expect(smoothToward(0, 1, TAU_MS)).toBeCloseTo(
      1 - Math.exp(-MAX_FRAME_MS / TAU_MS),
      12,
    );
  });

  it("is frame-rate independent", () => {
    // Two 8ms steps must land where one 16ms step does - the whole reason
    // this isn't a per-frame lerp.
    const oneStep = smoothToward(0, 1, 16);
    const twoSteps = smoothToward(smoothToward(0, 1, 8), 1, 8);
    expect(twoSteps).toBeCloseTo(oneStep, 12);
  });

  it("snaps once the remaining gap is below epsilon", () => {
    const nearlyThere = 1 - EPSILON / 2;
    expect(smoothToward(nearlyThere, 1, 16)).toBe(1);
  });

  it("returns the current value unchanged when already at the target", () => {
    expect(smoothToward(0.5, 0.5, 16)).toBe(0.5);
  });

  it("clamps an enormous frame delta instead of jumping", () => {
    // A backgrounded tab can hand back seconds. Without the clamp this would
    // be indistinguishable from a snap.
    const clamped = smoothToward(0, 1, 60_000);
    expect(clamped).toBe(smoothToward(0, 1, MAX_FRAME_MS));
    expect(clamped).toBeLessThan(1);
  });

  it("eases downward as well as upward", () => {
    expect(smoothToward(1, 0, 100, 100)).toBeCloseTo(Math.exp(-1), 12);
  });

  it("converges monotonically without overshooting", () => {
    let value = 0;
    for (let i = 0; i < 200; i++) {
      const next = smoothToward(value, 1, 16);
      expect(next).toBeGreaterThanOrEqual(value);
      expect(next).toBeLessThanOrEqual(1);
      value = next;
    }
    expect(value).toBe(1);
  });
});
