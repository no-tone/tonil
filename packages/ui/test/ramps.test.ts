import { describe, expect, it } from "vitest";
import {
  hexToRgb,
  lightnessOf,
  type Rgb,
  srgbToOklch,
} from "../src/gradient/oklab.js";
import {
  DUOTONES,
  deserializeRamp,
  duotoneRamp,
  RAMPS,
  type Ramp,
  rampToCss,
  rowsToCss,
  SIGNATURE_ACCENTS,
  sampleRamp,
  serializeRamp,
  signatureRamp,
} from "../src/gradient/ramps.js";

const RAMP: Ramp = [
  [0, [0, 0, 0]],
  [0.5, [100, 100, 100]],
  [1, [200, 200, 200]],
];

describe("sampleRamp", () => {
  it("returns exact stop colours at stop positions", () => {
    expect(sampleRamp(RAMP, 0)).toEqual([0, 0, 0]);
    expect(sampleRamp(RAMP, 0.5)).toEqual([100, 100, 100]);
    expect(sampleRamp(RAMP, 1)).toEqual([200, 200, 200]);
  });

  it("interpolates linearly between stops", () => {
    expect(sampleRamp(RAMP, 0.25)).toEqual([50, 50, 50]);
    expect(sampleRamp(RAMP, 0.75)).toEqual([150, 150, 150]);
  });

  it("clamps outside the ramp rather than extrapolating", () => {
    expect(sampleRamp(RAMP, -5)).toEqual([0, 0, 0]);
    expect(sampleRamp(RAMP, 5)).toEqual([200, 200, 200]);
  });

  it("handles a single-stop ramp", () => {
    expect(sampleRamp([[0, [7, 8, 9]]], 0.5)).toEqual([7, 8, 9]);
  });

  it("does not divide by zero on coincident stops", () => {
    const doubled: Ramp = [
      [0, [0, 0, 0]],
      [0.5, [10, 10, 10]],
      [0.5, [90, 90, 90]],
      [1, [100, 100, 100]],
    ];
    expect(() => sampleRamp(doubled, 0.5)).not.toThrow();
    expect(sampleRamp(doubled, 0.5)).toEqual([10, 10, 10]);
  });
});

describe("signatureRamp", () => {
  it("produces four ascending stops spanning 0 to 1", () => {
    const ramp = signatureRamp(hexToRgb("#4d8dff"));
    expect(ramp).toHaveLength(4);
    expect(ramp[0]?.[0]).toBe(0);
    expect(ramp[ramp.length - 1]?.[0]).toBe(1);
    for (let i = 1; i < ramp.length; i++) {
      expect(ramp[i]?.[0]).toBeGreaterThan(ramp[i - 1]?.[0] ?? -1);
    }
  });

  it("climbs in lightness from shadow to highlight", () => {
    const ramp = signatureRamp(hexToRgb("#ff5c00"));
    const lightnesses = ramp.map(([, colour]) => lightnessOf(colour));
    for (let i = 1; i < lightnesses.length; i++) {
      expect(lightnesses[i] ?? 0).toBeGreaterThan(lightnesses[i - 1] ?? 1);
    }
  });

  it("gives every signature the same visual weight", () => {
    // A pale mono and a saturated orange must sit at the same lightness, so
    // switching signature changes hue and not how heavy the panel feels.
    const weights = Object.values(SIGNATURE_ACCENTS).map((hex) => {
      const ramp = signatureRamp(hexToRgb(hex));
      return ramp.map(([, colour]) => lightnessOf(colour));
    });
    const first = weights[0] ?? [];
    for (const ladder of weights) {
      ladder.forEach((lightness, i) => {
        expect(lightness).toBeCloseTo(first[i] ?? 0, 1);
      });
    }
  });

  it("builds lighter stops for a light surface", () => {
    const dark = signatureRamp(hexToRgb("#4d8dff"), { dark: true });
    const light = signatureRamp(hexToRgb("#4d8dff"), { dark: false });
    expect(lightnessOf(light[0]?.[1] ?? [0, 0, 0])).toBeGreaterThan(
      lightnessOf(dark[0]?.[1] ?? [0, 0, 0]),
    );
  });
});

describe("RAMPS", () => {
  it("has a ramp for every signature accent", () => {
    for (const id of Object.keys(SIGNATURE_ACCENTS)) {
      expect(RAMPS[id as keyof typeof SIGNATURE_ACCENTS]).toHaveLength(4);
    }
  });
});

describe("serialization", () => {
  it("round-trips a ramp through its flat form", () => {
    const ramp = signatureRamp(hexToRgb("#b47cff"));
    expect(deserializeRamp(serializeRamp(ramp))).toEqual(ramp);
  });

  it("flattens to plain numbers so structured clone can carry it", () => {
    const flat = serializeRamp(RAMP);
    expect(flat[0]).toEqual([0, 0, 0, 0]);
    expect(flat.every((stop) => stop.every(Number.isFinite))).toBe(true);
  });
});

describe("css output", () => {
  it("emits the requested number of stops", () => {
    const css = rampToCss(RAMP, 4);
    expect(css.startsWith("linear-gradient(to bottom, ")).toBe(true);
    expect(css.match(/rgb\(/g)).toHaveLength(5);
  });

  it("honours a custom direction", () => {
    expect(rampToCss(RAMP, 2, "to right")).toContain("to right");
  });

  it("builds a gradient from a frame profile", () => {
    const rows = new Int16Array([0, 0, 0, 128, 128, 128, 255, 255, 255]);
    const css = rowsToCss(rows);
    expect(css).toContain("rgb(0 0 0) 0.0%");
    expect(css).toContain("rgb(128 128 128) 50.0%");
    expect(css).toContain("rgb(255 255 255) 100.0%");
  });

  it("rejects a profile too short to be a gradient", () => {
    expect(() => rowsToCss(new Int16Array([1, 2, 3]))).toThrow(/at least two/);
  });
});

describe("field colours land in gamut", () => {
  it("never produces a channel outside 0–255", () => {
    for (const hex of Object.values(SIGNATURE_ACCENTS)) {
      const ramp = signatureRamp(hexToRgb(hex));
      for (let t = 0; t <= 1; t += 0.05) {
        const colour: Rgb = sampleRamp(ramp, t);
        for (const channel of colour) {
          expect(channel).toBeGreaterThanOrEqual(0);
          expect(channel).toBeLessThanOrEqual(255);
        }
      }
    }
  });
});

/** Signed shortest angular distance from `a` to `b`, in (-180, 180]. */
function hueDelta(a: number, b: number): number {
  return ((b - a + 540) % 360) - 180;
}

describe("duotoneRamp", () => {
  const teal = hexToRgb("#0d4f54");
  const blush = hexToRgb("#ffb3c7");

  it("climbs monotonically in lightness", () => {
    // Without this the field has no direction to travel in as it scrolls.
    const ramp = duotoneRamp(teal, blush);
    const lightnesses = ramp.map(([, colour]) => lightnessOf(colour));
    for (let i = 1; i < lightnesses.length; i++) {
      expect(lightnesses[i] ?? 0).toBeGreaterThan(lightnesses[i - 1] ?? 1);
    }
  });

  it("ends near the hue of the second anchor", () => {
    const ramp = duotoneRamp(teal, blush);
    const last = ramp[ramp.length - 1]?.[1] ?? ([0, 0, 0] as const);
    expect(
      Math.abs(hueDelta(srgbToOklch(last)[2], srgbToOklch(blush)[2])),
    ).toBeLessThan(10);
  });

  it("takes the short way around the hue circle", () => {
    // Teal (~195°) to blue (~264°) is a 69° hop one way and 291° the other.
    // Going the long way would drag the ramp through green, yellow and red -
    // the muddy route that makes an sRGB-interpolated gradient look cheap.
    // No stop may sit further from the start than the short path is long.
    const from = hexToRgb("#0d4f54");
    const to = hexToRgb("#4d8dff");
    const ramp = duotoneRamp(from, to);
    const fromHue = srgbToOklch(from)[2];
    const span = Math.abs(hueDelta(fromHue, srgbToOklch(to)[2]));
    expect(span).toBeLessThan(180);

    for (const [, colour] of ramp) {
      const step = Math.abs(hueDelta(fromHue, srgbToOklch(colour)[2]));
      expect(step).toBeLessThanOrEqual(span + 5);
    }
  });

  it("stays in gamut for every named duotone", () => {
    for (const [from, to] of Object.values(DUOTONES)) {
      const ramp = duotoneRamp(hexToRgb(from), hexToRgb(to));
      for (let t = 0; t <= 1; t += 0.05) {
        for (const channel of sampleRamp(ramp, t)) {
          expect(channel).toBeGreaterThanOrEqual(0);
          expect(channel).toBeLessThanOrEqual(255);
        }
      }
    }
  });

  it("gives every duotone the same lightness ladder", () => {
    // Same guarantee as signatureRamp: switching palette changes hue, not how
    // heavy the field feels.
    const ladders = Object.values(DUOTONES).map(([from, to]) =>
      duotoneRamp(hexToRgb(from), hexToRgb(to)).map(([, c]) => lightnessOf(c)),
    );
    const first = ladders[0] ?? [];
    for (const ladder of ladders) {
      ladder.forEach((lightness, i) => {
        expect(lightness).toBeCloseTo(first[i] ?? 0, 1);
      });
    }
  });

  it("handles two identical anchors without producing NaN", () => {
    const ramp = duotoneRamp(teal, teal);
    for (const [, colour] of ramp) {
      for (const channel of colour) expect(Number.isFinite(channel)).toBe(true);
    }
  });

  it("exposes every named duotone through RAMPS", () => {
    for (const id of Object.keys(DUOTONES)) {
      expect(RAMPS[id as keyof typeof RAMPS]).toHaveLength(4);
    }
  });
});
