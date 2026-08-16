/* GLSL sources + colour conversion for VireGlobeGL's point-sphere shader.
   Split out from globe-gl.ts so the shader program and the pure hex→rgb
   conversion it needs are isolated from renderer/interaction wiring. */

type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const trimmed = (hex || "#ece9e1").trim();
  if (trimmed[0] !== "#") return [0.925, 0.914, 0.882];
  let h = trimmed.slice(1);
  if (h.length === 3)
    h = h
      .split("")
      .map((ch) => ch + ch)
      .join("");
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

export const VERT = /* glsl */ `
  attribute vec3 position;   // unit vector on the sphere
  attribute float land;      // 1.0 land, 0.0 ocean

  uniform float uRot;        // spin (radians)
  uniform float uTilt;       // tilt (radians)
  uniform float uSX;         // NDC scale x = 2R/w
  uniform float uSY;         // NDC scale y = 2R/h
  uniform float uDpr;
  uniform float uR;          // sphere radius (css px), for point sizing

  varying float vDepth;      // 0 back .. 1 front
  varying float vLand;

  void main() {
    // spin about Y, then tilt about X — matches the 2D projection exactly
    float cr = cos(uRot), sr = sin(uRot);
    float x = position.x * cr + position.z * sr;
    float z = -position.x * sr + position.z * cr;
    float y = position.y;
    float ct = cos(uTilt), st = sin(uTilt);
    float y2 = y * ct - z * st;
    float z2 = y * st + z * ct;

    vDepth = (z2 + 1.0) * 0.5;
    vLand = land;

    // orthographic: screen = center + v * R  ->  NDC (y flipped for canvas)
    gl_Position = vec4(x * uSX, -y2 * uSY, 0.0, 1.0);

    float base = land > 0.5 ? (0.9 + vDepth * 1.7) : 0.75;
    gl_PointSize = base * (uR / 260.0) * uDpr * 2.0;
  }
`;

export const FRAG = /* glsl */ `
  precision mediump float;

  uniform vec3 uColor;
  varying float vDepth;
  varying float vLand;

  void main() {
    // soft round disc
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float disc = smoothstep(0.5, 0.15, d);

    float front = step(0.001, vDepth - 0.5); // rough front/back split at equator
    float alpha;
    if (vLand > 0.5) {
      alpha = mix(0.05 + vDepth * 0.06, 0.22 + vDepth * 0.66, front);
    } else {
      alpha = mix(0.02, 0.05 + vDepth * 0.08, front);
    }
    gl_FragColor = vec4(uColor, alpha * disc);
  }
`;
