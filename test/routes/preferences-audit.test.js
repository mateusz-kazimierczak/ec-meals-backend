import { describe, expect, it } from "vitest";
import { getPostgresPool } from "../../src/_helpers/postgres.js";
import User from "../../src/_helpers/db/models/User.js";
import { buildTestApp } from "../helpers/app.js";
import { injectJson } from "../helpers/http.js";
import { seedUsers, tokenFor } from "../helpers/fixtures.js";

describe("preferences and audit routes", () => {
  it("gets and updates self preferences and writes audit history", async () => {
    const app = await buildTestApp();
    const { user } = await seedUsers();
    const token = tokenFor(user);

    const current = await injectJson(app, {
      url: "/api/preferences",
      token,
    });
    expect(current.statusCode).toBe(200);
    expect(current.body.preferences).toEqual({
      allowNextWeek: false,
      persistMeals: false,
      skipNotSignedUp: false,
    });

    const updated = await injectJson(app, {
      method: "POST",
      url: "/api/preferences",
      token,
      payload: { allowNextWeek: true, persistMeals: true, skipNotSignedUp: true },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.body).toEqual({ message: "OK" });

    const savedUser = await User.findById(user._id).lean();
    expect(savedUser.preferences).toMatchObject({
      allowNextWeek: true,
      persistMeals: false,
      skipNotSignedUp: false,
    });

    const auditRows = await getPostgresPool().query("SELECT * FROM user_settings_history WHERE target_user_id = $1", [user._id.toString()]);
    expect(auditRows.rows).toHaveLength(1);
    expect(auditRows.rows[0].change_type).toBe("GENERAL_PREFERENCES_UPDATE");
    expect(auditRows.rows[0].changed_fields).toEqual(expect.arrayContaining(["allowNextWeek"]));
  });

  it("allows admin to update another user's preferences and rejects regular users", async () => {
    const app = await buildTestApp();
    const { admin, user, otherStudent } = await seedUsers();

    const rejected = await injectJson(app, {
      method: "POST",
      url: "/api/preferences",
      token: tokenFor(user),
      headers: { user_id: otherStudent._id.toString() },
      payload: { allowNextWeek: true },
    });
    expect(rejected.statusCode).toBe(401);

    const allowed = await injectJson(app, {
      method: "POST",
      url: "/api/preferences",
      token: tokenFor(admin),
      headers: { user_id: user._id.toString() },
      payload: {
        allowNextWeek: true,
        persistMeals: true,
        skipNotSignedUp: true,
      },
    });
    expect(allowed.statusCode).toBe(200);

    const savedUser = await User.findById(user._id).lean();
    expect(savedUser.preferences).toMatchObject({
      allowNextWeek: true,
      persistMeals: true,
      skipNotSignedUp: true,
    });
  });

  it("updates notification preferences and device registration", async () => {
    const app = await buildTestApp();
    const { user } = await seedUsers();
    const token = tokenFor(user);

    const notificationPreferences = {
      emailEnabled: true,
      pushEnabled: true,
      rules: {
        missingRegularMeals: [true, false, false, false, false, false, false],
        missingPackedMeals: [false, true, false, false, false, false, false],
        missingAnyMeals: [false, false, true, false, false, false, false],
        fullReport: [false, false, false, true, false, false, false],
        reportOnNotifications: [false, false, false, false, true, false, false],
      },
      windows: {
        morning: [true, false, false, false, false, false, false],
        noon: [false, true, false, false, false, false, false],
        evening: [false, false, true, false, false, false, false],
      },
    };

    const updated = await injectJson(app, {
      method: "POST",
      url: "/api/preferences/notifications",
      token,
      payload: notificationPreferences,
    });
    expect(updated.statusCode).toBe(200);

    const device = await injectJson(app, {
      method: "POST",
      url: "/api/preferences/notifications/addDevice",
      token,
      payload: { device: { token: "device-token", platform: "ios" } },
    });
    expect(device.statusCode).toBe(200);

    const savedUser = await User.findById(user._id).lean();
    expect(savedUser.notifications.emailEnabled).toBe(true);
    expect(savedUser.notifications.pushEnabled).toBe(true);
    expect(savedUser.notifications.rules.missingRegularMeals).toEqual([true, false, false, false, false, false, false]);
    expect(savedUser.notifications.windows.noon).toEqual([false, true, false, false, false, false, false]);
    expect(savedUser.notifications.device).toEqual({ name: null, token: "device-token", platform: "ios" });

    const auditRows = await getPostgresPool().query(
      "SELECT change_type FROM user_settings_history WHERE target_user_id = $1 ORDER BY id",
      [user._id.toString()],
    );
    expect(auditRows.rows.map((row) => row.change_type)).toEqual([
      "NOTIFICATION_PREFERENCES_UPDATE",
      "NOTIFICATION_DEVICE_UPDATE",
    ]);
  });

  it("returns user settings audit logs in API-compatible shape", async () => {
    const app = await buildTestApp();
    const { user } = await seedUsers();
    const token = tokenFor(user);

    await injectJson(app, {
      method: "POST",
      url: "/api/preferences",
      token,
      payload: { allowNextWeek: true },
    });

    const logs = await injectJson(app, {
      url: "/api/logs/userSettings",
      token,
      headers: { week: "1" },
    });

    expect(logs.statusCode).toBe(200);
    expect(logs.body.logs).toHaveLength(1);
    expect(logs.body.logs[0]).toMatchObject({
      TARGET_USER_ID: user._id.toString(),
      CHANGE_TYPE: "GENERAL_PREFERENCES_UPDATE",
      IS_BATCH: false,
    });
    expect(logs.body.logs[0].CHANGE_TIME.value).toEqual(expect.any(String));
    expect(JSON.parse(logs.body.logs[0].CHANGED_FIELDS)).toEqual(expect.arrayContaining(["allowNextWeek"]));
  });
});
