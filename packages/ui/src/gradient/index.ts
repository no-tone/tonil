/* Public surface of the gradient field.

   Import from `@repo/ui/gradient`. The worker is deliberately not exported:
   it is loaded by URL from noise-gradient.ts and is an implementation
   detail of the mount function. */

export {
  FBM_MEAN,
  type FieldParams,
  type FieldState,
  fbm2,
  hash2,
  PROFILE_ROWS,
  renderField,
  renderGrainTile,
  smoothstep,
  valueNoise,
} from "./field.js";
export {
  type FeatherEdge,
  mountNoiseGradient,
  type NoiseGradientHandle,
  type NoiseGradientOptions,
} from "./noise-gradient.js";
export {
  hexToRgb,
  lightnessOf,
  type Oklab,
  type Oklch,
  oklabToOklch,
  oklabToSrgb,
  oklchToOklab,
  oklchToSrgb,
  type Rgb,
  rgbToCss,
  srgbToOklab,
  srgbToOklch,
  withHueShift,
  withLightness,
} from "./oklab.js";
export {
  DUOTONES,
  type DuotoneId,
  duotoneRamp,
  RAMPS,
  type Ramp,
  type RampId,
  type RampStop,
  rampToCss,
  rowsToCss,
  SIGNATURE_ACCENTS,
  type SignatureId,
  sampleRamp,
  signatureRamp,
} from "./ramps.js";
