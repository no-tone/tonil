/* Bottom-chrome city clocks. `formatTimeInZone` is pure (given a Date) so the
   formatting/fallback logic is unit-testable without faking timers. */

export function formatTimeInZone(
  timeZone: string,
  now: Date = new Date(),
): string {
  try {
    return now.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
      hour12: false,
    });
  } catch {
    return "--:--";
  }
}

export interface ClockElements {
  london: HTMLElement | null;
}

export function tickClocks(els: ClockElements, now: Date = new Date()): void {
  if (els.london)
    els.london.textContent = formatTimeInZone("Europe/London", now);
}
