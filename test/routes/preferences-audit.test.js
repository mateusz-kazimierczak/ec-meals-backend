import { describe, expect, it } from "vitest";
import { getPostgresPool } from "../../src/_helpers/postgres.js";
import User from "../../src/_helpers/db/models/User.js";
import { buildTestApp } from "../helpers/app.js";
import { injectJson } from "../helpers/http.js";
import { seedUsers, tokenFor } from "../helpers/fixtures.js";

describe("preferences and audit routes", () => {
  it("gets and updates self preferences and writes audit history", async () => {
    const app = await buildTestApp();
    const { student } = await seedUsers();
    const token = tokenFor(student);

    const current = await injectJson(app, {
      url: "/api/preferences",
      token,
    });
    expect(current.statusCode).toBe(200);
    expect(current.body.preferences).toEqual({ email: 1 });

    const updated = await injectJson(app, {
      method: "POST",
      url: "/api/preferences",
      token,
      payload: { email: 0, allowNextWeek: true, persistMeals: true, skipNotSignedUp: true },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.body).toEqual({ message: "OK" });

    const user = await User.findById(student._id).lean();
    expect(user.preferences).toMatchObject({
      email: 0,
      allowNextWeek: true,
    });
    expect(user.preferences.persistMeals).toBeUndefined();
    expect(user.preferences.skipNotSignedUp).toBeUndefined();

    const auditRows = await getPostgresPool().query("SELECT * FROM user_settings_history WHERE target_user_id = $1", [student._id.toString()]);
    expect(auditRows.rows).toHaveLength(1);
    expect(auditRows.rows[0].change_type).toBe("GENERAL_PREFERENCES_UPDATE");
    expect(auditRows.rows[0].changed_fields).toEqual(expect.arrayContaining(["email", "allowNextWeek"]));
  });

  it("allows admin to update another user's preferences and rejects regular users", async () => {
    const app = await buildTestApp();
    const { admin, student, otherStudent } = await seedUsers();

    const rejected = await injectJson(app, {
      method: "POST",
      url: "/api/preferences",
      token: tokenFor(student),
      headers: { user_id: otherStudent._id.toString() },
      payload: { email: 0 },
    });
    expect(rejected.statusCode).toBe(401);

    const allowed = await injectJson(app, {
      method: "POST",
      url: "/api/preferences",
      token: tokenFor(admin),
      headers: { user_id: student._id.toString() },
      payload: {
        email: 2,
        allowNextWeek: true,
        persistMeals: true,
        skipNotSignedUp: true,
      },
    });
    expect(allowed.statusCode).toBe(200);

    const user = await User.findById(student._id).lean();
    expect(user.preferences).toMatchObject({
      email: 2,
      allowNextWeek: true,
      persistMeals: true,
      skipNotSignedUp: true,
    });
  });

  it("updates notification preferences and device registration", async () => {
    const app = await buildTestApp();
    const { student } = await seedUsers();
    const token = tokenFor(student);

    const notificationPreferences = {
      notificationTypes: { email: true },
      schema: { meals: [true, false] },
      report: { report_on_notifications: [true] },
      schedule: { morning: [true] },
      device: null,
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

    const user = await User.findById(student._id).lean();
    expect(user.notifications.notificationTypes).toEqual({ email: true });
    expect(user.notifications.device).toEqual({ token: "device-token", platform: "ios" });

    const auditRows = await getPostgresPool().query(
      "SELECT change_type FROM user_settings_history WHERE target_user_id = $1 ORDER BY id",
      [student._id.toString()],
    );
    expect(auditRows.rows.map((row) => row.change_type)).toEqual([
      "NOTIFICATION_PREFERENCES_UPDATE",
      "NOTIFICATION_DEVICE_UPDATE",
    ]);
  });

  it("returns user settings audit logs in API-compatible shape", async () => {
    const app = await buildTestApp();
    const { student } = await seedUsers();
    const token = tokenFor(student);

    await injectJson(app, {
      method: "POST",
      url: "/api/preferences",
      token,
      payload: { email: 0, allowNextWeek: true },
    });

    const logs = await injectJson(app, {
      url: "/api/logs/userSettings",
      token,
      headers: { week: "1" },
    });

    expect(logs.statusCode).toBe(200);
    expect(logs.body.logs).toHaveLength(1);
    expect(logs.body.logs[0]).toMatchObject({
      TARGET_USER_ID: student._id.toString(),
      CHANGE_TYPE: "GENERAL_PREFERENCES_UPDATE",
      IS_BATCH: false,
    });
    expect(logs.body.logs[0].CHANGE_TIME.value).toEqual(expect.any(String));
    expect(JSON.parse(logs.body.logs[0].CHANGED_FIELDS)).toEqual(expect.arrayContaining(["email", "allowNextWeek"]));
  });
});
