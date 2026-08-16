/* WebGL rendering pipeline for VireGlobeGL: renderer/geometry/program/mesh
   setup (OGL) plus the per-frame draw (GPU dot sphere + a 2D overlay canvas
   for arcs/node halos and DOM-node positioning). Split out from globe-gl.ts
   so the render setup/drawing is isolated from drag/lifecycle wiring. */

import { Geometry, Mesh, Program, Renderer } from "ogl";
import { buildDotField, type GlobeNode, hexA, llToVec } from "./globe";
import { FRAG, hexToRgb, VERT } from "./globe-gl-shaders";

interface GlobeGLSceneOptions {
  canvas: HTMLCanvasElement;
  step: number;
  r: number;
  initialRot: number;
  initialAccent: string;
}

interface ProjectedPoint {
  x: number;
  y: number;
  z: number;
}

export class GlobeGLScene {
  private readonly renderer: Renderer;
  readonly overlay: HTMLCanvasElement;
  private readonly octx: CanvasRenderingContext2D;
  private readonly program: Program;
  private readonly mesh: Mesh;
  private readonly optR: number;
  private readonly dpr: number;

  private w = 0;
  private h = 0;
  private R = 0;
  private cx = 0;
  private cy = 0;

  constructor(opts: GlobeGLSceneOptions) {
    const { canvas } = opts;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.optR = opts.r;

    this.renderer = new Renderer({
      canvas,
      alpha: true,
      antialias: true,
      dpr: this.dpr,
      premultipliedAlpha: false,
    });
    const gl = this.renderer.gl;
    gl.clearColor(0, 0, 0, 0);

    // finer grid than the 2D globe — the GPU doesn't care
    const dots = buildDotField(opts.step);
    const position = new Float32Array(dots.length * 3);
    const land = new Float32Array(dots.length);
    dots.forEach((d, i) => {
      position[i * 3] = d.v[0];
      position[i * 3 + 1] = d.v[1];
      position[i * 3 + 2] = d.v[2];
      land[i] = d.land ? 1 : 0;
    });

    const geometry = new Geometry(gl, {
      position: { size: 3, data: position },
      land: { size: 1, data: land },
    });

    this.program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uRot: { value: opts.initialRot },
        uTilt: { value: 0 },
        uSX: { value: 1 },
        uSY: { value: 1 },
        uDpr: { value: this.dpr },
        uR: { value: 1 },
        uColor: { value: hexToRgb(opts.initialAccent) },
      },
    });
    // normal alpha blend — reads correctly over both light and dark themes
    this.program.setBlendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    this.mesh = new Mesh(gl, {
      geometry,
      program: this.program,
      mode: gl.POINTS,
    });

    // 2D overlay for arcs + node halos, layered between the globe (z0) and
    // the interactive nodes (z3).
    this.overlay = document.createElement("canvas");
    this.overlay.className = "vk-canvas vk-canvas--overlay";
    this.overlay.setAttribute("aria-hidden", "true");
    this.overlay.style.zIndex = "1";
    this.overlay.style.pointerEvents = "none";
    canvas.insertAdjacentElement("afterend", this.overlay);
    const octx = this.overlay.getContext("2d");
    if (!octx) throw new Error("GlobeGLScene: 2d overlay context unavailable");
    this.octx = octx;

    this.resize();
  }

  get radius(): number {
    return this.R;
  }

  get center(): { x: number; y: number } {
    return { x: this.cx, y: this.cy };
  }

  setAccent(hex: string): void {
    this.program.uniforms.uColor.value = hexToRgb(hex);
  }

  resize(): void {
    // The globe canvas is always the full fixed viewport. We must NOT read
    // clientWidth here: OGL's Renderer stamps a default 300x150 inline size
    // on the canvas, which beats the `.vk-canvas { width:100vw }` rule, so
    // clientWidth would report the collapsed 300 and lock the globe there.
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.w = w;
    this.h = h;
    this.R = Math.min(w, h) * this.optR;
    this.cx = w * 0.5;
    this.cy = h * 0.5;

    this.renderer.setSize(w, h);
    this.overlay.width = w * this.dpr;
    this.overlay.height = h * this.dpr;

    const u = this.program.uniforms;
    u.uSX.value = (2 * this.R) / w;
    u.uSY.value = (2 * this.R) / h;
    u.uR.value = this.R;
  }

  project(
    v: [number, number, number],
    rot: number,
    tilt: number,
  ): ProjectedPoint {
    const cosR = Math.cos(rot);
    const sinR = Math.sin(rot);
    const x = v[0] * cosR + v[2] * sinR;
    const z = -v[0] * sinR + v[2] * cosR;
    const y = v[1];
    const cosT = Math.cos(tilt);
    const sinT = Math.sin(tilt);
    const y2 = y * cosT - z * sinT;
    const z2 = y * sinT + z * cosT;
    return { x: this.cx + x * this.R, y: this.cy + y2 * this.R, z: z2 };
  }

  render(rot: number, tilt: number, nodes: GlobeNode[], accent: string): void {
    // GPU dot sphere
    this.program.uniforms.uRot.value = rot;
    this.program.uniforms.uTilt.value = tilt;
    this.renderer.render({ scene: this.mesh });

    // 2D overlay: clear, then arcs + node halos in CSS px (dpr transform)
    const ctx = this.octx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);

    const proj = nodes.map((n) => ({
      n,
      p: this.project(llToVec(n.lat, n.lon), rot, tilt),
    }));
    ctx.lineWidth = 1;
    for (let i = 0; i < proj.length; i++) {
      if (proj.length < 2) break;
      const a = proj[i];
      const b = proj[(i + 1) % proj.length];
      if (a.p.z > -0.1 && b.p.z > -0.1) {
        const mx = (a.p.x + b.p.x) / 2;
        const my = (a.p.y + b.p.y) / 2 - Math.abs(a.p.x - b.p.x) * 0.16 - 24;
        ctx.beginPath();
        ctx.strokeStyle = hexA(accent, 0.4);
        ctx.moveTo(a.p.x, a.p.y);
        ctx.quadraticCurveTo(mx, my, b.p.x, b.p.y);
        ctx.stroke();
      }
    }

    for (const { n, p } of proj) {
      const front = p.z > -0.06;
      if (n.el) {
        n.el.style.transform = `translate(-50%,-50%) translate(${p.x}px,${p.y}px)`;
        n.el.style.opacity = front ? "1" : "0";
        n.el.style.pointerEvents = front ? "auto" : "none";
      }
      if (front) {
        ctx.beginPath();
        ctx.fillStyle = hexA(accent, 0.14);
        ctx.arc(p.x, p.y, 12, 0, 6.2832);
        ctx.fill();
        ctx.beginPath();
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.5;
        ctx.arc(p.x, p.y, 12, 0, 6.2832);
        ctx.stroke();
        ctx.beginPath();
        ctx.fillStyle = accent;
        ctx.arc(p.x, p.y, 3, 0, 6.2832);
        ctx.fill();
      }
    }
  }

  destroy(): void {
    this.overlay.remove();
  }
}
