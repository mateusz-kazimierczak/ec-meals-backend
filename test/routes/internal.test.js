import { describe, expect, it } from "vitest";
import User from "../../src/_helpers/db/models/User.js";
import { defaultNotificationPreferences } from "../../src/domain/notificationDefaults.js";
import { buildTestApp } from "../helpers/app.js";
import { createUser } from "../helpers/fixtures.js";
import { injectJson } from "../helpers/http.js";

describe("internal routes", () => {
  it("keeps /api/test public", async () => {
    const app = await buildTestApp();

    const result = await injectJson(app, { url: "/api/test" });

    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({ message: "Hello World!" });
  });

  it("requires the internal secret when configured", async () => {
    const app = await buildTestApp();
    process.env.INTERNAL_API_SECRET = "internal-secret";

    const rejected = await injectJson(app, { url: "/api/internal/init" });
    expect(rejected.statusCode).toBe(401);
    expect(rejected.body).toEqual({ message: "Unauthorized" });

    const allowed = await injectJson(app, {
      url: "/api/internal/init",
      headers: { "x-internal-secret": "internal-secret" },
    });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.body).toEqual({ message: "Admin user created" });

    delete process.env.INTERNAL_API_SECRET;
  });

  it("fails closed when the internal secret is not configured", async () => {
    const app = await buildTestApp();
    delete process.env.INTERNAL_API_SECRET;

    const result = await injectJson(app, { url: "/api/internal/init" });

    expect(result.statusCode).toBe(503);
    expect(result.body).toEqual({ message: "Internal API is not configured" });
  });

  it("adds default notification preferences to all users", async () => {
    const app = await buildTestApp();
    process.env.INTERNAL_API_SECRET = "internal-secret";
    const first = await createUser({ username: "first", notifications: { device: { token: "old" } } });
    const second = await createUser({ username: "second", notifications: null });

    const result = await injectJson(app, {
      url: "/api/internal/tasks/add_notifications_preferences_to_all_users",
      headers: { "x-internal-secret": "internal-secret" },
    });

    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({ message: "Added default notifications preferences to all users" });

    const users = await User.find({ _id: { $in: [first._id, second._id] } }).sort({ username: 1 }).lean();
    expect(users.map((user) => user.notifications)).toEqual([
      defaultNotificationPreferences,
      defaultNotificationPreferences,
    ]);

    delete process.env.INTERNAL_API_SECRET;
  });
});
