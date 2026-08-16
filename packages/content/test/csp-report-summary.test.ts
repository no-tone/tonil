import { describe, expect, it } from "vitest";
import { summarizeCspReport } from "../src/csp-report-summary";

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
