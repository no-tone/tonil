import { z } from "zod";

/**
 * The `csp-report` object browsers POST per the CSP report-uri directive.
 * Every field is optional/nullable in practice - browsers vary in what they
 * populate - so this validates shape and types without rejecting reports
 * that are missing fields.
 */
export const cspReportBodySchema = z.object({
  "csp-report": z
    .object({
      "document-uri": z.string().optional(),
      referrer: z.string().optional(),
      "violated-directive": z.string().optional(),
      "effective-directive": z.string().optional(),
      "original-policy": z.string().optional(),
      disposition: z.string().optional(),
      "blocked-uri": z.string().optional(),
      "line-number": z.number().optional(),
      "column-number": z.number().optional(),
      "source-file": z.string().optional(),
      "status-code": z.number().optional(),
      "script-sample": z.string().optional(),
    })
    .passthrough(),
});

export type CspReportBody = z.infer<typeof cspReportBodySchema>;
