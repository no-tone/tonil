import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { validationProblemHook } from "../src/problem-hook";

describe("validationProblemHook", () => {
  it("renders zod-validator failures as application/problem+json", async () => {
    const app = new Hono();
    app.get(
      "/status",
      zValidator(
        "query",
        z.object({ device: z.string().min(1) }),
        validationProblemHook,
      ),
      (c) => c.json({ ok: true }),
    );

    const res = await app.request("/status");
    expect(res.status).toBe(400);
    expect(res.headers.get("Content-Type")).toBe(
      "application/problem+json; charset=utf-8",
    );
    const body = await res.json();
    expect(body.title).toBe("Validation Failed");
    expect(body.errors[0].path).toBe("device");
  });

  it("passes valid input through untouched", async () => {
    const app = new Hono();
    app.get(
      "/status",
      zValidator(
        "query",
        z.object({ device: z.string().min(1) }),
        validationProblemHook,
      ),
      (c) => c.json({ ok: true, device: c.req.valid("query").device }),
    );

    const res = await app.request("/status?device=laptop");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, device: "laptop" });
  });
});
