/* Theme + signature-accent controller: dark/light toggle (crossfaded via
   a class, not a wipe) and the six signature-color swatches, whose choice
   is layered onto both themes via inline custom properties (see
   `applyAccent`, which beats tokens.css's `html[data-theme=...]` rules on
   specificity). */

import { readStored, writeStored } from "@repo/ui/storage";
import type { Theme, TonilThemeHelpers } from "@repo/ui/theme-bootstrap";
import { SIGS, type Sig } from "./data";

const SIG_KEY = "desktop:sig";
const THEME_FADE_MS = 520;

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

/** Pure: resolves the signature id to boot with from storage, falling back
 *  to "mono" for anything unset or no longer in `SIGS`. */
export function resolveInitialSigId(stored: string | null): string {
  return stored && SIGS.some((s) => s.id === stored) ? stored : "mono";
}

interface ThemeControllerDeps {
  swatchWrap: HTMLElement | null;
  /** Called whenever the accent changes, so callers (the globe) can re-read
   *  the `--accent` custom property. */
  onAccentChange: () => void;
  helpers: () => TonilThemeHelpers;
  reduceMotion: boolean;
}

export class ThemeController {
  private sigId: string;

  constructor(private readonly deps: ThemeControllerDeps) {
    this.sigId = resolveInitialSigId(readStored(SIG_KEY));
  }

  get signatureId(): string {
    return this.sigId;
  }

  applyAccent(): void {
    const sig: Sig = SIGS.find((s) => s.id === this.sigId) ?? SIGS[0];
    const variant = currentTheme() === "light" ? sig.light : sig.dark;
    const style = document.documentElement.style;
    style.setProperty("--accent", variant.c);
    style.setProperty("--accent-hover", variant.hi);
    style.setProperty("--text-on-accent", variant.on);
    this.deps.onAccentChange();

    const { swatchWrap } = this.deps;
    if (swatchWrap) {
      for (const btn of Array.from(swatchWrap.children)) {
        const el = btn as HTMLElement;
        el.classList.toggle("is-on", el.dataset.sig === this.sigId);
      }
    }
  }

  buildSwatches(): void {
    const { swatchWrap } = this.deps;
    if (!swatchWrap) return;
    const theme = currentTheme();
    swatchWrap.replaceChildren();
    for (const sig of SIGS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `vk-swatch${sig.id === this.sigId ? " is-on" : ""}`;
      btn.dataset.sig = sig.id;
      btn.title = sig.id;
      btn.setAttribute("aria-label", `signature: ${sig.id}`);
      btn.style.background = (theme === "light" ? sig.light : sig.dark).c;
      btn.addEventListener("click", () => {
        this.sigId = sig.id;
        writeStored(SIG_KEY, this.sigId);
        this.applyAccent();
      });
      swatchWrap.appendChild(btn);
    }
  }

  setTheme(theme: Theme): void {
    const root = document.documentElement;
    if (!this.deps.reduceMotion) {
      root.classList.add("vk-theming");
      window.setTimeout(
        () => root.classList.remove("vk-theming"),
        THEME_FADE_MS,
      );
    }
    const help = this.deps.helpers();
    if (help.setStoredTheme) {
      help.setStoredTheme(theme);
    } else {
      root.dataset.theme = theme;
      writeStored("theme", theme);
    }
    this.buildSwatches();
    this.applyAccent();
  }

  toggleTheme(): void {
    this.setTheme(currentTheme() === "dark" ? "light" : "dark");
  }
}
