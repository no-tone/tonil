export interface CspReportSummary {
  path: string;
  size: number;
  malformed: boolean;
  disposition: string | null;
  effectiveDirective: string | null;
  violatedDirective: string | null;
  blockedOrigin: string | null;
  documentPath: string | null;
  sourceFilePath: string | null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function sanitizeOrigin(value: unknown): string | null {
  const raw = readString(value);
  if (!raw || raw === "inline" || raw === "eval") return raw;
  try {
    return new URL(raw).origin;
  } catch {
    return raw;
  }
}

function sanitizePath(value: unknown): string | null {
  const raw = readString(value);
  if (!raw) return null;
  try {
    return new URL(raw).pathname;
  } catch {
    return raw.startsWith("/") ? raw : null;
  }
}

function malformedSummary(reportPath: string, size: number): CspReportSummary {
  return {
    path: reportPath,
    size,
    malformed: true,
    disposition: null,
    effectiveDirective: null,
    violatedDirective: null,
    blockedOrigin: null,
    documentPath: null,
    sourceFilePath: null,
  };
}

/**
 * Ported from no-tone.com's src/utils/csp-report.ts. Takes an already-validated
 * (via @repo/validation's cspReportBodySchema) report body and reduces it to a
 * loggable summary - sanitizing origins/paths so we never log full querystrings
 * or credentials that might leak into a blocked-uri.
 */
/**
 * A violation the site provokes against itself, which no operator can act on.
 *
 * Astro's `<ClientRouter />` fetches the next page and parses it with
 * DOMParser. A document created that way inherits the creating document's
 * CSP, so the *new* response's nonce is judged against the *old* response's
 * policy and never matches - one report per inline <style>, on every
 * navigation, in a page that then renders perfectly (the styles are
 * restamped before they are swapped in; see @repo/ui/site/csp-nonce.ts).
 *
 * These are dropped rather than logged. A report sink that is mostly
 * self-inflicted noise is one nobody reads, which costs more than the
 * reports are worth.
 *
 * Deliberately narrow: inline styles only, and only where the browser named
 * a source file. A genuine inline-style injection would report `blocked-uri:
 * inline` with no source file, and still comes through.
 */
export function isSelfInflictedTransitionReport(
  summary: CspReportSummary,
): boolean {
  const directive = summary.effectiveDirective ?? summary.violatedDirective;
  return (
    !summary.malformed &&
    (directive === "style-src-elem" || directive === "style-src") &&
    summary.blockedOrigin === "inline" &&
    summary.sourceFilePath !== null
  );
}

export function summarizeCspReport(
  body: string,
  reportPath: string,
): CspReportSummary {
  try {
    const parsed = JSON.parse(body) as {
      "csp-report"?: Record<string, unknown>;
    };
    const report = parsed?.["csp-report"];
    if (!report || typeof report !== "object") {
      return malformedSummary(reportPath, body.length);
    }

    return {
      path: reportPath,
      size: body.length,
      malformed: false,
      disposition: readString(report.disposition),
      effectiveDirective: readString(report["effective-directive"]),
      violatedDirective: readString(report["violated-directive"]),
      blockedOrigin: sanitizeOrigin(report["blocked-uri"]),
      documentPath: sanitizePath(report["document-uri"]),
      sourceFilePath: sanitizePath(report["source-file"]),
    };
  } catch {
    return malformedSummary(reportPath, body.length);
  }
}
