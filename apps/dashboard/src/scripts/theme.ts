import type { TonilThemeHelpers } from "@repo/ui/theme-bootstrap";

/**
 * Wires the topbar's theme toggle button. Storage and page-load bootstrap
 * are already handled by packages/ui's BaseHead.astro (window.tonil.*) — this
 * only handles the toggle button's click and icon.
 */

declare global {
  interface Window {
    tonil?: TonilThemeHelpers;
  }
}

interface ThemeToggleElements {
  button: HTMLButtonElement | null;
  icon: HTMLElement | null;
}

const ICON_BY_THEME: Record<"light" | "dark", string> = {
  light: "☀︎",
  dark: "☾",
};

export function initThemeToggle({ button, icon }: ThemeToggleElements): void {
  const paintIcon = (theme: "light" | "dark") => {
    if (icon) icon.textContent = ICON_BY_THEME[theme];
  };

  paintIcon(window.tonil?.readTheme?.() ?? "dark");

  button?.addEventListener("click", () => {
    const current = window.tonil?.readTheme?.() ?? "dark";
    const next: "light" | "dark" = current === "dark" ? "light" : "dark";
    window.tonil?.setStoredTheme?.(next);
    paintIcon(next);
  });
}
