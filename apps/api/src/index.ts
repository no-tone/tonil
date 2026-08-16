import { TRUSTED_ORIGINS } from "@repo/auth";
import {
  apiCatalog,
  problemJson,
  securityHeaders,
} from "@repo/hono-middleware";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppEnv } from "./env";
import { authRoute } from "./routes/auth";
import { cspReportRoute } from "./routes/csp-report";
import { infoRoute } from "./routes/info";
import { projectsRoute } from "./routes/projects";
import { statusRoute } from "./routes/status";

const API_ORIGIN = "https://api.no-tone.com";

// /projects (fetched from no-tone.com's own scripts), /status (fetched from
// the dashboard's), and /api/auth/* (the dashboard's login form, credentialed)
// are all cross-origin browser fetches, so they need real CORS — this API
// had none until browser testing surfaced it. TRUSTED_ORIGINS is the same
// list @repo/auth uses for Better Auth's own origin check, imported rather
// than duplicated.
const ALLOWED_ORIGINS = new Set(TRUSTED_ORIGINS);
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
    // /api/auth/* needs the session cookie sent/readable cross-origin from
    // apps/dashboard; harmless for the plain public GETs on the other routes.
    credentials: true,
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
// Mounted at Better Auth's conventional default basePath (`/api/auth`), not
// just `/auth` — its handler internally matches routes against that prefix,
// and every ecosystem client/tool (including the Better Auth Infrastructure
// dashboard's default "path to your Better Auth API" field) assumes it.
app.route("/api/auth", authRoute);

export default app;
