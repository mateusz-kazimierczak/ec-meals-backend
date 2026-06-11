import { describe, expect, it } from "vitest";
import { buildTestApp } from "../helpers/app.js";
import { injectJson } from "../helpers/http.js";
import { seedUsers, tokenFor } from "../helpers/fixtures.js";

describe("authorization", () => {
  it("rejects protected routes without a token", async () => {
    const app = await buildTestApp();

    const { statusCode, body } = await injectJson(app, { url: "/api/meals" });

    expect(statusCode).toBe(401);
    expect(body.message).toBe("invalid Authentication");
  });

  it("rejects protected routes with invalid tokens", async () => {
    const app = await buildTestApp();

    const { statusCode, body } = await injectJson(app, {
      url: "/api/meals",
      token: "not-a-jwt",
    });

    expect(statusCode).toBe(401);
    expect(body.message).toBe("invalid Authentication");
  });

  it("rejects non-admin users on admin routes", async () => {
    const app = await buildTestApp();
    const { student } = await seedUsers();

    const { statusCode, body } = await injectJson(app, {
      url: "/api/diets",
      token: tokenFor(student),
    });

    expect(statusCode).toBe(401);
    expect(body.message).toBe("Unauthorized");
  });

  it("allows activity editors and rejects normal users on activity routes", async () => {
    const app = await buildTestApp();
    const { student, activityEditor } = await seedUsers();

    const rejected = await injectJson(app, {
      url: "/api/activities",
      token: tokenFor(student),
    });
    expect(rejected.statusCode).toBe(401);

    const allowed = await injectJson(app, {
      url: "/api/activities",
      token: tokenFor(activityEditor),
    });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.body).toEqual({ campaigns: [] });
  });
});
