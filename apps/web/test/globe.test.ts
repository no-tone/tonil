import { describe, expect, it } from "vitest";
import { hexA, llToVec } from "../src/scripts/desktop/globe";

describe("llToVec", () => {
  it("maps the equator/prime-meridian point to +X", () => {
    const [x, y, z] = llToVec(0, 0);
    expect(x).toBeCloseTo(1);
    expect(y).toBeCloseTo(0);
    expect(z).toBeCloseTo(0);
  });

  it("maps the north pole to +Y regardless of longitude", () => {
    const [x, y, z] = llToVec(90, 45);
    expect(y).toBeCloseTo(1);
    expect(x).toBeCloseTo(0, 5);
    expect(z).toBeCloseTo(0, 5);
  });

  it("returns a unit vector for an arbitrary lat/lon", () => {
    const v = llToVec(34, -42);
    const len = Math.hypot(v[0], v[1], v[2]);
    expect(len).toBeCloseTo(1);
  });
});

describe("hexA", () => {
  it("converts a 6-digit hex to an rgba() string with the given alpha", () => {
    expect(hexA("#ece9e1", 0.4)).toBe("rgba(236,233,225,0.4)");
  });

  it("expands a 3-digit hex before converting", () => {
    expect(hexA("#fff", 1)).toBe("rgba(255,255,255,1)");
  });

  it("passes through a non-hex value unchanged", () => {
    expect(hexA("currentColor", 0.5)).toBe("currentColor");
  });

  it("falls back to the default accent for an empty value", () => {
    expect(hexA("", 1)).toBe("rgba(236,233,225,1)");
  });
});
