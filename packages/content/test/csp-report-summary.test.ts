import { describe, expect, it } from "vitest";
import {
  isSelfInflictedTransitionReport,
  summarizeCspReport,
} from "../src/csp-report-summary";

describe("summarizeCspReport", () => {
  it("sanitizes a real CSP report to origins/paths, dropping querystrings", () => {
    const body = JSON.stringify({
      "csp-report": {
        "document-uri": "https://no-tone.com/?utm_source=x",
        "violated-directive": "script-src",
        "blocked-uri": "https://evil.example.com/payload.js?x=1",
        "source-file": "https://no-tone.com/scripts/main.js",
      },
    });
    const summary = summarizeCspReport(body, "/api/csp-report");
    expect(summary.malformed).toBe(false);
    expect(summary.documentPath).toBe("/");
    expect(summary.blockedOrigin).toBe("https://evil.example.com");
    expect(summary.sourceFilePath).toBe("/scripts/main.js");
  });

  it("flags a payload missing the csp-report envelope as malformed", () => {
    const summary = summarizeCspReport(
      JSON.stringify({ foo: "bar" }),
      "/api/csp-report",
    );
    expect(summary.malformed).toBe(true);
  });

  it("flags invalid JSON as malformed instead of throwing", () => {
    const summary = summarizeCspReport("not json", "/api/csp-report");
    expect(summary.malformed).toBe(true);
    expect(summary.size).toBe(8);
  });
});

describe("isSelfInflictedTransitionReport", () => {
  const report = (fields: Record<string, unknown>) =>
    summarizeCspReport(JSON.stringify({ "csp-report": fields }), "/csp-report");

  it("drops the inline-style report ClientRouter provokes on every navigation", () => {
    // Astro parses the next page with DOMParser; that document inherits this
    // one's CSP, so the new response's nonce is judged against the old
    // policy. The page renders correctly - the styles are restamped before
    // being swapped in - so there is nothing for an operator to do.
    expect(
      isSelfInflictedTransitionReport(
        report({
          "effective-directive": "style-src-elem",
          "blocked-uri": "inline",
          "source-file": "https://no-tone.com/_astro/ClientRouter.abc.js",
          "document-uri": "https://no-tone.com/work",
        }),
      ),
    ).toBe(true);
  });

  it("keeps an inline-style violation with no source file", () => {
    // What an actual injected <style> looks like: no script to blame.
    expect(
      isSelfInflictedTransitionReport(
        report({
          "effective-directive": "style-src-elem",
          "blocked-uri": "inline",
          "document-uri": "https://no-tone.com/",
        }),
      ),
    ).toBe(false);
  });

  it("keeps script violations, which is the whole point of the sink", () => {
    expect(
      isSelfInflictedTransitionReport(
        report({
          "effective-directive": "script-src-elem",
          "blocked-uri": "inline",
          "source-file": "https://no-tone.com/_astro/ClientRouter.abc.js",
        }),
      ),
    ).toBe(false);
  });

  it("keeps a blocked external stylesheet", () => {
    expect(
      isSelfInflictedTransitionReport(
        report({
          "effective-directive": "style-src-elem",
          "blocked-uri": "https://evil.example/x.css",
          "source-file": "https://no-tone.com/_astro/ClientRouter.abc.js",
        }),
      ),
    ).toBe(false);
  });

  it("keeps a malformed report", () => {
    expect(isSelfInflictedTransitionReport(summarizeCspReport("{", "/x"))).toBe(
      false,
    );
  });
});
