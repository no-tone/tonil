import { describe, expect, it } from "vitest";
import {
  FBM_MEAN,
  fbm2,
  hash2,
  smoothstep,
  valueNoise,
} from "../src/gradient/field.js";

describe("smoothstep", () => {
  it("pins both ends and the midpoint", () => {
    expect(smoothstep(0)).toBe(0);
    expect(smoothstep(1)).toBe(1);
    expect(smoothstep(0.5)).toBe(0.5);
  });

  it("is flat at the ends", () => {
    // Derivative 0 at t=0 and t=1 is what stops noise cells creasing.
    expect(smoothstep(0.001)).toBeLessThan(0.001);
    expect(smoothstep(0.999)).toBeGreaterThan(0.999);
  });
});

describe("hash2", () => {
  it("stays in [0, 1)", () => {
    for (let x = -50; x < 50; x += 7) {
      for (let y = -50; y < 50; y += 7) {
        const value = hash2(x, y);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    }
  });

  it("is deterministic", () => {
    expect(hash2(12, 34)).toBe(hash2(12, 34));
  });

  it("decorrelates neighbours", () => {
    // Adjacent cells must not be adjacent values, or the noise reads as a ramp.
    const deltas: number[] = [];
    for (let i = 0; i < 64; i++)
      deltas.push(Math.abs(hash2(i, 0) - hash2(i + 1, 0)));
    const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    expect(mean).toBeGreaterThan(0.2);
  });

  it("is not symmetric in its arguments", () => {
    expect(hash2(3, 9)).not.toBe(hash2(9, 3));
  });
});

describe("valueNoise", () => {
  it("reproduces the lattice value at integer coordinates", () => {
    expect(valueNoise(4, 7)).toBeCloseTo(hash2(4, 7), 12);
  });

  it("is continuous across a cell boundary", () => {
    const before = valueNoise(3 - 1e-7, 2.5);
    const after = valueNoise(3 + 1e-7, 2.5);
    expect(Math.abs(after - before)).toBeLessThan(1e-5);
  });

  it("stays within the range of its corners", () => {
    for (let i = 0; i < 200; i++) {
      const x = i * 0.37;
      const y = i * 0.21;
      const value = valueNoise(x, y);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});

describe("fbm2", () => {
  it("has a mean close to the FBM_MEAN the field subtracts", () => {
    // If this drifts, the field's displacement stops being zero-centred and
    // progress: 0 no longer shows the ramp's first stop.
    let total = 0;
    let count = 0;
    for (let x = 0; x < 60; x += 0.7) {
      for (let y = 0; y < 60; y += 0.7) {
        total += fbm2(x, y);
        count++;
      }
    }
    expect(total / count).toBeCloseTo(FBM_MEAN, 1);
  });

  it("varies more slowly than raw hash noise", () => {
    const smooth = Math.abs(fbm2(1, 1) - fbm2(1.01, 1));
    const raw = Math.abs(hash2(1, 1) - hash2(2, 1));
    expect(smooth).toBeLessThan(raw);
  });
});
