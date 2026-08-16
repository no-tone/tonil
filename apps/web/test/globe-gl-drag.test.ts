import { describe, expect, it } from "vitest";
import {
  applyDragDelta,
  exceedsDragThreshold,
  isWithinHitRadius,
  TILT_LIMIT,
} from "../src/scripts/desktop/globe-gl-drag";

describe("isWithinHitRadius", () => {
  it("is true for a point inside the sphere's hit-circle", () => {
    expect(isWithinHitRadius({ x: 100, y: 100 }, { x: 100, y: 100 }, 50)).toBe(
      true,
    );
  });

  it("is true up to the 1.05x tolerance beyond the radius", () => {
    expect(isWithinHitRadius({ x: 152, y: 100 }, { x: 100, y: 100 }, 50)).toBe(
      true,
    );
  });

  it("is false well outside the hit-circle", () => {
    expect(isWithinHitRadius({ x: 300, y: 100 }, { x: 100, y: 100 }, 50)).toBe(
      false,
    );
  });
});

describe("exceedsDragThreshold", () => {
  it("is false for tiny movement (a click, not a drag)", () => {
    expect(exceedsDragThreshold(1, 1)).toBe(false);
  });

  it("is true once combined movement reaches the threshold", () => {
    expect(exceedsDragThreshold(3, 1)).toBe(true);
  });
});

describe("applyDragDelta", () => {
  it("increases rotation with rightward movement", () => {
    const { rot } = applyDragDelta(0, 0, 10, 0);
    expect(rot).toBeCloseTo(0.06);
  });

  it("decreases tilt with downward movement (dy > 0)", () => {
    const { tilt } = applyDragDelta(0, 0, 0, 10);
    expect(tilt).toBeCloseTo(-0.04);
  });

  it("clamps tilt to +/- TILT_LIMIT", () => {
    const { tilt: high } = applyDragDelta(0, 10, 0, -100000);
    expect(high).toBe(TILT_LIMIT);
    const { tilt: low } = applyDragDelta(0, -10, 0, 100000);
    expect(low).toBe(-TILT_LIMIT);
  });
});
