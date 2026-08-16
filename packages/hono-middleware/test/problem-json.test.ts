import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { describe, expect, it } from "vitest";
import { problemJson } from "../src/problem-json";

describe("problemJson", () => {
  it("renders an HTTPException as application/problem+json", async () => {
    const app = new Hono();
    app.onError(problemJson());
    app.get("/widgets/1", () => {
      throw new HTTPException(404, { message: "Widget not found" });
    });

    const res = await app.request("/widgets/1");
    expect(res.status).toBe(404);
    expect(res.headers.get("Content-Type")).toBe(
      "application/problem+json; charset=utf-8",
    );
    const body = await res.json();
    expect(body).toMatchObject({
      title: "Widget not found",
      status: 404,
      instance: "/widgets/1",
    });
  });

  it("falls back to a 500 problem for unexpected errors", async () => {
    const app = new Hono();
    app.onError(problemJson());
    app.get("/boom", () => {
      throw new Error("kaboom");
    });

    const res = await app.request("/boom");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.status).toBe(500);
    expect(body.title).toBe("Internal Server Error");
  });
});
