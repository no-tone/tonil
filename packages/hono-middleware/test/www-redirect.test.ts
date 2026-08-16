import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { wwwRedirect } from "../src/www-redirect";

function buildApp() {
  const app = new Hono();
  app.use(wwwRedirect({ apexHost: "no-tone.com" }));
  app.get("/*", (c) => c.text("ok"));
  return app;
}

describe("wwwRedirect", () => {
  it("301s www to the apex host, preserving path", async () => {
    const res = await buildApp().request("https://www.no-tone.com/projects", {
      redirect: "manual",
    });
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("https://no-tone.com/projects");
  });

  it("passes through requests already on the apex host", async () => {
    const res = await buildApp().request("https://no-tone.com/projects");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });
});
