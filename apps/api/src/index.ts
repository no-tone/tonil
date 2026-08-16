import {
  apiCatalog,
  problemJson,
  securityHeaders,
} from "@repo/hono-middleware";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppEnv } from "./env";
import { cspReportRoute } from "./routes/csp-report";
import { infoRoute } from "./routes/info";
import { projectsRoute } from "./routes/projects";
import { statusRoute } from "./routes/status";

const API_ORIGIN = "https://api.no-tone.com";

// /projects is fetched client-side from no-tone.com's browser scripts, so it
// needs real CORS. /status and /csp-report aren't browser cross-origin
// fetches — status is proxied server-to-server by apps/dashboard (see its
// api/status.ts), and csp-report is posted by the browser's own CSP
// reporting mechanism, not application JS subject to CORS.
const ALLOWED_ORIGINS = new Set([
  "https://no-tone.com",
  "https://www.no-tone.com",
]);
const LOCAL_DEV_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

const app = new Hono<AppEnv>();

app.onError(problemJson());

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (ALLOWED_ORIGINS.has(origin) || LOCAL_DEV_ORIGIN.test(origin)) {
        return origin;
      }
      return null;
    },
  }),
);

app.use(
  "*",
  securityHeaders({
    devHostnames: ["localhost", "127.0.0.1"],
    connectSrc: ["https://api.github.com", "https://api.tailscale.com"],
    // This API is deliberately consumed cross-origin by every frontend in
    // the monorepo (unlike apps/web/apps/dashboard, which default to
    // same-origin) — otherwise browsers block the response even with CORS
    // headers present, independent of the CORS check above.
    crossOriginResourcePolicy: "cross-origin",
  }),
);

app.use(
  "*",
  apiCatalog({
    entries: [
      { href: `${API_ORIGIN}/projects` },
      { href: `${API_ORIGIN}/status` },
      { href: `${API_ORIGIN}/csp-report` },
    ],
  }),
);

app.route("/projects", projectsRoute);
app.route("/status", statusRoute);
app.route("/csp-report", cspReportRoute);
app.route("/info", infoRoute);

export default app;
