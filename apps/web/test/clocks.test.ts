import { describe, expect, it } from "vitest";
import { formatTimeInZone, tickClocks } from "../src/scripts/desktop/clocks";

describe("formatTimeInZone", () => {
  it("formats a known instant in a given IANA zone as 24h HH:MM", () => {
    // 12:00 UTC on a summer date -> London is BST (UTC+1) -> 13:00.
    const now = new Date("2026-07-01T12:00:00Z");
    expect(formatTimeInZone("Europe/London", now)).toBe("13:00");
  });

  it("falls back to --:-- for an invalid time zone instead of throwing", () => {
    const now = new Date("2026-07-01T12:00:00Z");
    expect(formatTimeInZone("Not/AZone", now)).toBe("--:--");
  });
});

describe("tickClocks", () => {
  it("writes formatted times into the london/sf elements", () => {
    const london = document.createElement("b");
    const sf = document.createElement("b");
    const now = new Date("2026-07-01T12:00:00Z");
    tickClocks({ london, sf }, now);
    expect(london.textContent).toBe(formatTimeInZone("Europe/London", now));
    expect(sf.textContent).toBe(formatTimeInZone("America/Los_Angeles", now));
  });

  it("tolerates missing elements", () => {
    expect(() => tickClocks({ london: null, sf: null })).not.toThrow();
  });
});
