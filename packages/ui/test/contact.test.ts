import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountContact } from "../src/site/contact.js";

/* Long enough for the address to finish typing: 15 characters at the 72ms
   cadence is comfortably past vi.waitFor's one-second default. The pace is
   the effect, so the test waits rather than the code hurrying. */
const TYPED_MS = 4000;

/** The markup Footer.astro renders for the contact control. */
function markup(email = "msg@no-tone.com"): HTMLButtonElement {
  document.body.innerHTML = `
    <button class="sitefoot__contact" type="button" data-copy="${email}"
            aria-label="Copy email address ${email}">
      <span class="sitefoot__label">contact</span>
      <span class="sitefoot__mail"><span data-typed></span><span class="sitefoot__caret"></span></span>
      <span class="sitefoot__copied" role="status" data-copied-badge></span>
    </button>`;
  const el = document.querySelector<HTMLButtonElement>("[data-copy]");
  if (!el) throw new Error("fixture is missing the control");
  return el;
}

function typed(): string {
  return document.querySelector("[data-typed]")?.textContent ?? "";
}

function badge(): string {
  return document.querySelector("[data-copied-badge]")?.textContent ?? "";
}

describe("mountContact", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    // Typing character-by-character is the default; the reduced-motion path
    // gets its own test.
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn() }),
    );
  });

  it("reveals on the first click without copying", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    const el = markup();
    mountContact();
    el.click();

    expect(el.dataset.revealed).toBe("1");
    expect(writeText).not.toHaveBeenCalled();
    // A first click that copied would put the address on the clipboard of
    // anyone who merely wanted to see it.
    await vi.waitFor(() => expect(typed()).toBe("msg@no-tone.com"), TYPED_MS);
  });

  it("copies on the second click and confirms", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    const el = markup();
    mountContact();
    el.click();
    el.click();

    expect(writeText).toHaveBeenCalledWith("msg@no-tone.com");
    await vi.waitFor(() => {
      expect(badge()).toBe("Copied");
      expect(el.dataset.copied).toBe("1");
    });
  });

  it("skips the typing when reduced motion is asked for", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn() }),
    );
    const el = markup();
    mountContact();
    el.click();

    expect(typed()).toBe("msg@no-tone.com");
  });

  it("does not throw when the clipboard is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });

    const el = markup();
    mountContact();
    el.click();
    expect(() => el.click()).not.toThrow();
    // The address is on screen either way, so a refused copy costs nothing
    // but a manual selection.
    await vi.waitFor(() => expect(typed()).toBe("msg@no-tone.com"), TYPED_MS);
    expect(badge()).toBe("");
  });

  it("binds each control once, however often it is mounted", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    const el = markup();
    // Called after every view transition, including the first load.
    mountContact();
    mountContact();
    mountContact();

    el.click();
    el.click();
    expect(writeText).toHaveBeenCalledTimes(1);
  });
});
