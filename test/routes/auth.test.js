import { describe, expect, it } from "vitest";
import { buildTestApp } from "../helpers/app.js";
import { injectJson } from "../helpers/http.js";
import { createUser, userPassword } from "../helpers/fixtures.js";

describe("auth routes", () => {
  it("logs in active users and returns a signed token", async () => {
    const app = await buildTestApp();
    await createUser({ username: "user", role: "user" });

    const { statusCode, body } = await injectJson(app, {
      method: "POST",
      url: "/api/auth",
      payload: { username: " user ", password: ` ${userPassword} ` },
    });

    expect(statusCode).toBe(200);
    expect(body.token).toEqual(expect.any(String));
    expect(body.username).toBe("user");
    expect(body.role).toBe("user");
    expect(body.preferences).toEqual({
      allowNextWeek: false,
      persistMeals: false,
      skipNotSignedUp: false,
    });
    expect(body.device_registered).toBe(false);
  });

  it("returns noUser for unknown users", async () => {
    const app = await buildTestApp();

    const { statusCode, body } = await injectJson(app, {
      method: "POST",
      url: "/api/auth",
      payload: { username: "missing", password: userPassword },
    });

    expect(statusCode).toBe(200);
    expect(body).toEqual({ code: "noUser" });
  });

  it("returns badPass for invalid passwords", async () => {
    const app = await buildTestApp();
    await createUser({ username: "user" });

    const { statusCode, body } = await injectJson(app, {
      method: "POST",
      url: "/api/auth",
      payload: { username: "user", password: "wrong-password" },
    });

    expect(statusCode).toBe(200);
    expect(body).toEqual({ code: "badPass" });
  });

  it("rejects inactive users", async () => {
    const app = await buildTestApp();
    await createUser({ username: "inactive", active: false });

    const { statusCode, body } = await injectJson(app, {
      method: "POST",
      url: "/api/auth",
      payload: { username: "inactive", password: userPassword },
    });

    expect(statusCode).toBe(402);
    expect(body.error).toMatch(/not active/i);
  });
});
