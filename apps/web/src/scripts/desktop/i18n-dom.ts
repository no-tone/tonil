/* Applies the active language to every `[data-i18n]` node in the DOM (the
   globe nodes, the rail, the top status line, the language toggle). */

import { type Lang, tt } from "./data";

export function applyLangToDom(lang: Lang): void {
  document.documentElement.lang = lang;
  for (const el of Array.from(
    document.querySelectorAll<HTMLElement>("[data-i18n]"),
  )) {
    const key = el.dataset.i18n;
    if (!key) continue;
    el.textContent =
      tt(lang, key) + (el.hasAttribute("data-arrow") ? " ↗" : "");
  }
  for (const btn of Array.from(
    document.querySelectorAll<HTMLElement>(".vk-lang [data-lang]"),
  )) {
    btn.classList.toggle("is-on", btn.dataset.lang === lang);
  }
}
