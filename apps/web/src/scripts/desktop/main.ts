/* no-tone desktop — entry point (vanilla port of app.jsx). Progressive
   enhancement over the server-rendered chrome; see bootstrap.ts for the
   actual wiring. */

import { bootstrap } from "./bootstrap";

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
} else {
  bootstrap();
}
