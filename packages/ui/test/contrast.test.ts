import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/* The text tokens have to stay legible, and "legible" is a number.
 *
 * `--text-faint` shipped at rgba(255,255,255,0.4) for a long time, which is
 * 3.66:1 on black - under WCAG AA's 4.5:1, and every use of it is normal-size
 * text. Nothing caught it, because a colour that is slightly too dim looks
 * like a design decision right up until someone runs an audit.
 *
 * So the ratios are computed here from the stylesheet itself. Lowering a token
 * past the threshold now fails the build rather than the next audit. */

const tokensCss = readFileSync(
  resolve(process.cwd(), "src/styles/tokens.css"),
  "utf8",
);

type Rgb = [number, number, number];

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** What an `rgba()` ink actually looks like once composited onto a background. */
function flatten(ink: Rgb, alpha: number, background: Rgb): Rgb {
  return ink.map((c, i) =>
    Math.round(c * alpha + background[i] * (1 - alpha)),
  ) as Rgb;
}

/**
 * Read `--name: rgba(r, g, b, a)` out of a block of the stylesheet.
 *
 * Scoped to a block because the same token names are declared twice, once per
 * theme, and reading the first match would silently only ever test the dark
 * one - which is the half that was already correct.
 */
function readToken(block: string, name: string): { ink: Rgb; alpha: number } {
  const match = block.match(new RegExp(`${name}:\\s*rgba\\(([^)]+)\\)`, "i"));
  if (!match) throw new Error(`${name} not found, or no longer an rgba()`);
  const parts = match[1].split(",").map((p) => Number(p.trim()));
  return { ink: [parts[0], parts[1], parts[2]], alpha: parts[3] };
}

function blockFor(selector: string): string {
  const start = tokensCss.indexOf(selector);
  if (start === -1) throw new Error(`no ${selector} block in tokens.css`);
  const open = tokensCss.indexOf("{", start);
  const close = tokensCss.indexOf("}", open);
  return tokensCss.slice(open, close);
}

/** WCAG 2.1 AA, normal-size text. Every use of these tokens is normal-size. */
const AA_NORMAL = 4.5;

const THEMES: { name: string; block: string; background: Rgb }[] = [
  { name: "dark", block: ":root", background: [0, 0, 0] },
  {
    name: "light",
    block: 'html[data-theme="light"]',
    background: [0xf7, 0xf7, 0xf5],
  },
];

describe("text tokens meet WCAG AA", () => {
  for (const theme of THEMES) {
    for (const token of ["--text-muted", "--text-faint"]) {
      it(`${token} is readable in the ${theme.name} theme`, () => {
        const { ink, alpha } = readToken(blockFor(theme.block), token);
        const ratio = contrast(
          flatten(ink, alpha, theme.background),
          theme.background,
        );
        expect(
          Number(ratio.toFixed(2)),
          `${token} (${theme.name}) is ${ratio.toFixed(2)}:1`,
        ).toBeGreaterThanOrEqual(AA_NORMAL);
      });
    }
  }

  it("keeps faint fainter than muted, or the hierarchy is a lie", () => {
    // Raising a failing token is the fix; raising it past its neighbour just
    // moves the problem into the design.
    for (const theme of THEMES) {
      const block = blockFor(theme.block);
      const muted = readToken(block, "--text-muted");
      const faint = readToken(block, "--text-faint");
      expect(faint.alpha, `${theme.name}`).toBeLessThan(muted.alpha);
    }
  });
});
