import { describe, expect, it } from "vitest";
import {
  hexToRgb,
  isInGamut,
  lightnessOf,
  oklabToSrgb,
  oklchToOklab,
  oklchToSrgb,
  type Rgb,
  rgbToCss,
  srgbToOklab,
  srgbToOklch,
  withHueShift,
  withLightness,
} from "../src/gradient/oklab.js";

const SAMPLES: Rgb[] = [
  [0, 0, 0],
  [255, 255, 255],
  [77, 141, 255],
  [61, 220, 151],
  [255, 92, 0],
  [236, 233, 225],
];

describe("srgb ↔ oklab", () => {
  it("round-trips every sample exactly", () => {
    for (const rgb of SAMPLES) {
      expect(oklabToSrgb(srgbToOklab(rgb))).toEqual(rgb);
    }
  });

  it("puts black at 0 and white at 1 lightness", () => {
    expect(lightnessOf([0, 0, 0])).toBeCloseTo(0, 6);
    expect(lightnessOf([255, 255, 255])).toBeCloseTo(1, 6);
  });

  it("reports greys as achromatic", () => {
    const [, chroma] = srgbToOklch([128, 128, 128]);
    expect(chroma).toBeLessThan(1e-6);
  });
});

describe("withLightness", () => {
  it("hits the requested lightness", () => {
    for (const target of [0.3, 0.5, 0.68, 0.86]) {
      const result = withLightness([77, 141, 255], target);
      expect(lightnessOf(result)).toBeCloseTo(target, 2);
    }
  });

  it("preserves hue while changing lightness", () => {
    const source: Rgb = [255, 92, 0];
    const [, , sourceHue] = srgbToOklch(source);
    const [, , liftedHue] = srgbToOklch(withLightness(source, 0.86));
    // Gamut mapping gives up chroma rather than hue, so this holds even
    // where the requested colour is well outside what sRGB can show.
    expect(Math.abs(liftedHue - sourceHue)).toBeLessThan(1);
  });

  it("normalises different accents to the same visual weight", () => {
    // The whole point of the absolute ladder in signatureRamp: a pale mono
    // and a saturated orange must land in the same place.
    const mono = withLightness(hexToRgb("#ece9e1"), 0.68);
    const orange = withLightness(hexToRgb("#ff5c00"), 0.68);
    expect(lightnessOf(mono)).toBeCloseTo(lightnessOf(orange), 2);
  });
});

describe("gamut mapping", () => {
  it("leaves in-gamut colours untouched", () => {
    for (const rgb of SAMPLES) {
      expect(oklchToSrgb(srgbToOklch(rgb))).toEqual(rgb);
    }
  });

  it("holds lightness for a colour sRGB cannot represent", () => {
    // Saturated blue at high lightness is far outside the gamut; clipping
    // it would land ~0.03 low, which is what this exists to prevent.
    const [, chroma, hue] = srgbToOklch([77, 141, 255]);
    const mapped = oklchToSrgb([0.86, chroma, hue]);
    expect(lightnessOf(mapped)).toBeCloseTo(0.86, 2);
  });

  it("gives up chroma to do it", () => {
    const [, chroma, hue] = srgbToOklch([77, 141, 255]);
    const [, mappedChroma] = srgbToOklch(oklchToSrgb([0.86, chroma, hue]));
    expect(mappedChroma).toBeLessThan(chroma);
  });

  it("reports gamut membership honestly", () => {
    expect(isInGamut(srgbToOklab([255, 255, 255]))).toBe(true);
    expect(isInGamut(oklchToOklab([0.86, 0.3, 264]))).toBe(false);
  });
});

describe("withHueShift", () => {
  it("rotates hue by the requested amount", () => {
    const source: Rgb = [77, 141, 255];
    const [, , sourceHue] = srgbToOklch(source);
    const [, , shiftedHue] = srgbToOklch(withHueShift(source, 32));
    const delta = (((shiftedHue - sourceHue) % 360) + 360) % 360;
    // Gamut clipping moves it a little; the direction and rough size hold.
    expect(delta).toBeGreaterThan(20);
    expect(delta).toBeLessThan(45);
  });
});

describe("hexToRgb", () => {
  it("parses long and short form, with or without the hash", () => {
    expect(hexToRgb("#4d8dff")).toEqual([77, 141, 255]);
    expect(hexToRgb("4d8dff")).toEqual([77, 141, 255]);
    expect(hexToRgb("#fff")).toEqual([255, 255, 255]);
  });

  it("rejects anything else", () => {
    expect(() => hexToRgb("#12345")).toThrow(/Not a hex colour/);
    expect(() => hexToRgb("rebeccapurple")).toThrow(/Not a hex colour/);
  });
});

describe("rgbToCss", () => {
  it("rounds to whole channels", () => {
    expect(rgbToCss([12.4, 200.6, 0])).toBe("rgb(12 201 0)");
  });
});
