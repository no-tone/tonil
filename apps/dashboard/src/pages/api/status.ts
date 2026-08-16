import type { APIRoute } from "astro";

// Same-origin proxy for apps/api's /status: this dashboard is gated behind
// a Cloudflare Access policy, so every request reaching this Worker already
// carries a Cf-Access-Jwt-Assertion header that Access itself attached and
// verified. Forward it to apps/api server-to-server so that route can verify
// it too — a client-side browser fetch straight to api.no-tone.com wouldn't
// carry it (different hostname, and a plain fetch() can't complete Access's
// interactive login redirect the way a full page navigation can).
const STATUS_URL = "https://api.no-tone.com/status";
const ACCESS_JWT_HEADER = "Cf-Access-Jwt-Assertion";

export const GET: APIRoute = async ({ request }) => {
  const jwt = request.headers.get(ACCESS_JWT_HEADER);
  const headers = new Headers();
  if (jwt) headers.set(ACCESS_JWT_HEADER, jwt);

  const upstream = await fetch(STATUS_URL, { headers });
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
};
