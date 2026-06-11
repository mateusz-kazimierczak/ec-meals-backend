import { describe, expect, it } from "vitest";
import { buildTestApp } from "../helpers/app.js";
import { injectJson } from "../helpers/http.js";

describe("health routes", () => {
  it("returns health without requiring database work", async () => {
    const app = await buildTestApp();

    const { statusCode, body } = await injectJson(app, { url: "/healthz" });

    expect(statusCode).toBe(200);
    expect(body).toEqual({ ok: true });
  });

  it("returns ready after Mongo and Postgres initialization", async () => {
    const app = await buildTestApp();

    const { statusCode, body } = await injectJson(app, { url: "/readyz" });

    expect(statusCode).toBe(200);
    expect(body).toEqual({ ok: true });
  });

  it("returns 404 for unknown routes", async () => {
    const app = await buildTestApp();

    const { statusCode } = await injectJson(app, { url: "/missing-route" });

    expect(statusCode).toBe(404);
  });
});
