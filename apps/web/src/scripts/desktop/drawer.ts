/* Slide-over drawer: mounts/unmounts a panel's DOM, tracks focus so closing
   restores it, and reflects the open panel onto the rail nav's active state. */

import type { Lang } from "./data";
import { revealPanel } from "./motion";
import { buildPanel, type PanelId } from "./panels";

interface DrawerElements {
  drawer: HTMLElement;
  sheetBody: HTMLElement;
  closeBtn: HTMLElement | null;
  btt: HTMLElement | null;
}

export class DrawerController {
  private openId: PanelId | null = null;
  private lastFocused: HTMLElement | null = null;

  constructor(
    private readonly els: DrawerElements,
    private readonly getLang: () => Lang,
  ) {}

  get open(): PanelId | null {
    return this.openId;
  }

  renderPanel(id: PanelId): void {
    const panel = buildPanel(id, this.getLang());
    this.els.sheetBody.replaceChildren(panel);
    this.els.sheetBody.scrollTop = 0;
    this.els.btt?.classList.remove("is-on");
    revealPanel(panel);
  }

  /** Rebuild the currently open panel (e.g. after a language switch). */
  rerenderIfOpen(): void {
    if (this.openId) this.renderPanel(this.openId);
  }

  openPanel(id: PanelId): void {
    this.lastFocused = (document.activeElement as HTMLElement) ?? null;
    this.openId = id;
    this.renderPanel(id);
    this.els.drawer.classList.add("is-open");
    this.els.drawer.removeAttribute("inert");
    this.reflectActive();
    const btn = this.els.closeBtn;
    if (btn) window.setTimeout(() => btn.focus(), 60);
  }

  closePanel(): void {
    if (!this.openId) return;
    this.openId = null;
    this.els.drawer.classList.remove("is-open");
    this.els.drawer.setAttribute("inert", "");
    this.reflectActive();
    window.setTimeout(() => {
      if (!this.openId) this.els.sheetBody.replaceChildren();
    }, 360);
    if (this.lastFocused && document.contains(this.lastFocused))
      this.lastFocused.focus();
  }

  reflectActive(): void {
    for (const el of Array.from(
      document.querySelectorAll<HTMLElement>(".vk-rail__item[data-node]"),
    )) {
      el.classList.toggle("is-on", el.dataset.node === this.openId);
    }
  }
}
