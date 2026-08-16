/* ============================================================
   VireGlobeGL — WebGL upgrade of the dotted EARTH.

   Drop-in for VireGlobe: same public surface (setNodes / readAccent /
   start / stop / destroy). `tryCreate` returns null when WebGL is
   unavailable so the caller can fall back to the 2D renderer.

   The actual work is split across two modules so this file stays a thin
   orchestrator (lifecycle: raf loop, resize/visibility listeners, wiring):
   - globe-gl-scene.ts: OGL renderer/geometry/program/mesh setup and the
     per-frame GPU + 2D-overlay draw.
   - globe-gl-drag.ts: pointer drag-to-rotate/tilt interaction.
   ============================================================ */

import type { GlobeNode, GlobeOptions } from "./globe";
import { bindGlobeDrag, type DragState } from "./globe-gl-drag";
import { GlobeGLScene } from "./globe-gl-scene";

const DEG = Math.PI / 180;

export class VireGlobeGL {
  private readonly glCanvas: HTMLCanvasElement;
  private readonly scene: GlobeGLScene;

  private tilt: number;
  private readonly autoSpeed: number;
  private rot = 2.6;
  private dragging = false;
  private nodes: GlobeNode[] = [];
  private accent = "#ece9e1";

  private running = false;
  private wantRun = false;
  private raf: number | null = null;

  private readonly onResize: () => void;
  private readonly onVisibility: () => void;
  private readonly detachDrag: () => void;

  /** Returns a WebGL globe, or null if WebGL/OGL init fails (caller falls
   *  back to the 2D VireGlobe). */
  static tryCreate(
    canvas: HTMLCanvasElement,
    opts: GlobeOptions = {},
  ): VireGlobeGL | null {
    try {
      return new VireGlobeGL(canvas, opts);
    } catch {
      return null;
    }
  }

  private constructor(canvas: HTMLCanvasElement, opts: GlobeOptions = {}) {
    this.glCanvas = canvas;
    this.tilt = (opts.tilt ?? -16) * DEG;
    this.autoSpeed = opts.autoSpeed ?? 0.0016;

    this.scene = new GlobeGLScene({
      canvas,
      step: opts.step ? opts.step : 3.0,
      r: opts.r || 0.46,
      initialRot: this.rot,
      initialAccent: this.accent,
    });

    this.onResize = () => this.scene.resize();
    window.addEventListener("resize", this.onResize);
    this.onVisibility = () => {
      if (document.hidden) {
        this.running = false;
        if (this.raf) cancelAnimationFrame(this.raf);
      } else if (this.wantRun && !this.running) {
        this.running = true;
        this.tick();
      }
    };
    document.addEventListener("visibilitychange", this.onVisibility);

    this.detachDrag = bindGlobeDrag({
      element: canvas,
      getCenter: () => this.scene.center,
      getRadius: () => this.scene.radius,
      getState: (): DragState => ({
        rot: this.rot,
        tilt: this.tilt,
        dragging: this.dragging,
      }),
      onChange: (next) => {
        this.rot = next.rot;
        this.tilt = next.tilt;
        this.dragging = next.dragging;
      },
    });

    this.readAccent();
  }

  readAccent(): void {
    const host =
      this.glCanvas.closest("[data-theme]") || document.documentElement;
    const c = getComputedStyle(host).getPropertyValue("--accent").trim();
    if (c) {
      this.accent = c;
      this.scene.setAccent(c);
    }
  }

  setNodes(nodes: GlobeNode[]): void {
    this.nodes = nodes;
  }

  private frame(): void {
    this.scene.render(this.rot, this.tilt, this.nodes, this.accent);
    if (!this.dragging) this.rot += this.autoSpeed;
  }

  private tick = (): void => {
    if (!this.running) return;
    this.frame();
    this.raf = requestAnimationFrame(this.tick);
  };

  start(): void {
    this.wantRun = true;
    if (this.running || document.hidden) return;
    this.running = true;
    this.tick();
  }

  stop(): void {
    this.wantRun = false;
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
  }

  destroy(): void {
    this.stop();
    window.removeEventListener("resize", this.onResize);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.detachDrag();
    this.scene.destroy();
  }
}
