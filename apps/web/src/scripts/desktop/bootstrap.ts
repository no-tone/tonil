/* no-tone desktop — app bootstrap. Wires the globe, the node/rail
   navigation, the theme + signature + language toggles, the clocks, the
   coordinate readout and the slide-over drawer together. Each concern lives
   in its own module (theme.ts, drawer.ts, navigation.ts, i18n-dom.ts,
   clocks.ts, storage.ts); this file's only job is composing them against the
   real DOM and event listeners. */

import { readStored, writeStored } from "@repo/ui/storage";
import type { TonilThemeHelpers } from "@repo/ui/theme-bootstrap";
import { type ClockElements, tickClocks } from "./clocks";
import { initCursor } from "./cursor";
import { type Lang, NODES } from "./data";
import { DrawerController } from "./drawer";
import { VireGlobe } from "./globe";
import { VireGlobeGL } from "./globe-gl";
import { applyLangToDom } from "./i18n-dom";
import {
  type NavigationActions,
  performNavigation,
  resolveNavigationIntent,
} from "./navigation";
import type { PanelId } from "./panels";
import { ThemeController } from "./theme";

declare global {
  interface Window {
    tonil?: TonilThemeHelpers;
  }
}

const LANG_KEY = "desktop:lang";

const $ = <T extends HTMLElement = HTMLElement>(
  sel: string,
  root: ParentNode = document,
): T | null => root.querySelector<T>(sel);

// Shared theme helpers @repo/ui's BaseHead installs on `window.tonil`.
function helpers(): TonilThemeHelpers {
  return window.tonil ?? {};
}

export function bootstrap(): void {
  const canvas = $<HTMLCanvasElement>("#vk-canvas");
  const drawerEl = $("#vk-drawer");
  const sheetBody = $("#vk-sheet-body");
  const backdrop = $("#vk-backdrop");
  const closeBtn = $("#vk-close");
  const btt = $("#vk-btt");
  const word = $("#vk-word");
  const swatchWrap = $("#vk-swatches");
  const coordX = $("#vk-x");
  const coordY = $("#vk-y");
  const clockLondon = $("#vk-clock-london");

  if (!canvas || !drawerEl || !sheetBody) return;

  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  let lang: Lang = readStored(LANG_KEY) === "pt" ? "pt" : "en";

  /* ---------- globe (WebGL when available, canvas-2D fallback) ---------- */
  const globe =
    VireGlobeGL.tryCreate(canvas, { autoSpeed: 0.0016, tilt: -16 }) ??
    new VireGlobe(canvas, { step: 4.2, autoSpeed: 0.0016, tilt: -16 });
  const nodeEls = Array.from(
    document.querySelectorAll<HTMLElement>(".vk-node[data-node]"),
  );
  globe.setNodes(
    NODES.map((n) => ({
      id: n.id,
      lat: n.lat,
      lon: n.lon,
      el: nodeEls.find((el) => el.dataset.node === n.id) ?? null,
    })),
  );
  globe.readAccent();
  globe.start();

  /* ---------- theme + signature ---------- */
  const theme = new ThemeController({
    swatchWrap,
    onAccentChange: () => globe.readAccent(),
    helpers,
    reduceMotion,
  });

  /* ---------- drawer ---------- */
  const drawer = new DrawerController(
    { drawer: drawerEl, sheetBody, closeBtn, btt },
    () => lang,
  );

  /* ---------- i18n ---------- */
  function applyLang(): void {
    applyLangToDom(lang);
    drawer.rerenderIfOpen(); // rebuild open panel in the new language
  }

  /* ---------- navigation ---------- */
  const navigationActions: NavigationActions = {
    openPanel: (id: PanelId) => drawer.openPanel(id),
    navigateTo: (href) => {
      window.location.href = href;
    },
    openExternal: (href) => {
      window.open(href, "_blank", "noopener,noreferrer");
    },
  };
  function go(id: string): void {
    performNavigation(resolveNavigationIntent(id, NODES), navigationActions);
  }

  /* ---------- wire navigation ---------- */
  for (const el of Array.from(
    document.querySelectorAll<HTMLElement>("[data-node]"),
  )) {
    el.addEventListener("click", () => {
      const id = el.dataset.node;
      if (id) go(id);
    });
  }
  word?.addEventListener("click", () => theme.toggleTheme());
  closeBtn?.addEventListener("click", () => drawer.closePanel());
  backdrop?.addEventListener("click", () => drawer.closePanel());

  // back-to-top: reveal once the panel is scrolled, scroll to top on click
  if (btt) {
    sheetBody.addEventListener(
      "scroll",
      () => btt.classList.toggle("is-on", sheetBody.scrollTop > 260),
      { passive: true },
    );
    btt.addEventListener("click", () => {
      sheetBody.scrollTo({
        top: 0,
        behavior: reduceMotion ? "auto" : "smooth",
      });
    });
  }
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && drawer.open) drawer.closePanel();
  });
  for (const btn of Array.from(
    document.querySelectorAll<HTMLElement>(".vk-lang [data-lang]"),
  )) {
    btn.addEventListener("click", () => {
      lang = btn.dataset.lang === "pt" ? "pt" : "en";
      writeStored(LANG_KEY, lang);
      applyLang();
    });
  }

  /* ---------- clocks ---------- */
  const clockEls: ClockElements = { london: clockLondon };
  tickClocks(clockEls);
  window.setInterval(() => tickClocks(clockEls), 15000);

  /* ---------- coordinate readout ---------- */
  const pad = (n: number) =>
    String(Math.max(0, Math.min(9999, Math.round(n)))).padStart(4, "0");
  window.addEventListener(
    "pointermove",
    (e) => {
      if (coordX) coordX.textContent = pad(e.clientX);
      if (coordY) coordY.textContent = pad(e.clientY);
    },
    { passive: true },
  );

  /* ---------- boot ---------- */
  drawerEl.setAttribute("inert", "");
  initCursor();
  theme.buildSwatches();
  theme.applyAccent();
  applyLang();

  // keep accent legible if theme changes elsewhere (e.g. cross-tab sync)
  window.addEventListener("tonil:themechange", () => {
    theme.buildSwatches();
    theme.applyAccent();
  });
}
