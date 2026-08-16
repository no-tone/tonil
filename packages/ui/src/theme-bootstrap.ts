export type Theme = "light" | "dark";

/**
 * Shape of the client theme helpers BaseHead.astro's inline bootstrap script
 * installs on `window.tonil` (see BaseHead.astro's "Shared client theme
 * helpers" script block) — the single source of truth both apps' own
 * theme-toggle scripts type against, instead of each hand-declaring (and
 * previously drifting on) their own copy.
 */
export interface TonilThemeHelpers {
  getStoredTheme?: () => Theme | null;
  applyTheme?: (theme: Theme) => void;
  readTheme?: () => Theme;
  syncTheme?: (theme?: Theme) => Theme;
  setStoredTheme?: (theme: Theme) => void;
}
