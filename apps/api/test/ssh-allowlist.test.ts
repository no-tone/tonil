import { describe, expect, it } from "vitest";
import { parseAllowlist, timingSafeEqual } from "../src/services/ssh-allowlist";

// 43 base64 characters, the exact length of an unpadded SHA-256 digest.
const FP_A = `SHA256:${"A".repeat(43)}`;
const FP_B = `SHA256:${"B".repeat(43)}`;

describe("parseAllowlist", () => {
  it("reads a fingerprint, label and scopes", () => {
    const grants = parseAllowlist(`${FP_A} laptop dotfiles`);
    expect(grants.get(FP_A)).toEqual({ label: "laptop", scopes: ["dotfiles"] });
  });

  it("supports several scopes on one key", () => {
    const grants = parseAllowlist(`${FP_A} laptop dotfiles notes`);
    expect(grants.get(FP_A)?.scopes).toEqual(["dotfiles", "notes"]);
  });

  it("treats a key with only a label as recognised but ungranted", () => {
    const grants = parseAllowlist(`${FP_A} phone`);
    expect(grants.get(FP_A)).toEqual({ label: "phone", scopes: [] });
  });

  it("ignores comments and blank lines", () => {
    const grants = parseAllowlist(
      [
        "# my keys",
        "",
        `${FP_A} laptop dotfiles`,
        "   ",
        `# ${FP_B} revoked`,
      ].join("\n"),
    );
    expect(grants.size).toBe(1);
    expect(grants.has(FP_B)).toBe(false);
  });

  it("tolerates extra whitespace", () => {
    const grants = parseAllowlist(`   ${FP_A}    laptop   dotfiles   `);
    expect(grants.get(FP_A)).toEqual({ label: "laptop", scopes: ["dotfiles"] });
  });

  it("skips malformed lines instead of throwing", () => {
    // A typo in one entry must cost that key its access, not lock everyone
    // out by taking the whole endpoint down.
    const grants = parseAllowlist(
      [
        "not-a-fingerprint laptop dotfiles",
        "SHA256:tooshort laptop dotfiles",
        "MD5:aa:bb:cc laptop dotfiles",
        `${FP_A} laptop dotfiles`,
      ].join("\n"),
    );
    expect(grants.size).toBe(1);
    expect(grants.get(FP_A)?.scopes).toEqual(["dotfiles"]);
  });

  it("returns an empty map for missing or empty input", () => {
    expect(parseAllowlist(undefined).size).toBe(0);
    expect(parseAllowlist("").size).toBe(0);
    expect(parseAllowlist("\n\n  \n").size).toBe(0);
  });

  it("lets a later line replace an earlier one for the same key", () => {
    const grants = parseAllowlist(`${FP_A} old dotfiles\n${FP_A} new`);
    expect(grants.get(FP_A)).toEqual({ label: "new", scopes: [] });
  });
});

describe("timingSafeEqual", () => {
  it("matches identical strings", async () => {
    await expect(timingSafeEqual("token", "token")).resolves.toBe(true);
  });

  it("rejects different strings, including prefixes and lengths", async () => {
    for (const other of ["toke", "tokens", "Token", "", "xxxxx"]) {
      await expect(timingSafeEqual("token", other)).resolves.toBe(false);
    }
  });

  it("handles unicode without throwing", async () => {
    await expect(timingSafeEqual("tökén", "tökén")).resolves.toBe(true);
    await expect(timingSafeEqual("tökén", "token")).resolves.toBe(false);
  });
});
