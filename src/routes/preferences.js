import connectDB from "../_helpers/db/connect.js";
import User from "../_helpers/db/models/User.js";
import { buildAuditRowDiff, logUserSettingsChange } from "../_helpers/userSettingsAudit.js";
import { auditContext } from "../lib/audit.js";
import { getHeader } from "../lib/http.js";

const preferenceFields = ["email", "allowNextWeek", "persistMeals", "skipNotSignedUp"];
const notificationFields = ["notificationTypes", "schedule", "schema", "report", "device"];
const deviceFields = ["notificationTypes", "device"];

const preferenceSnapshot = (preferences = {}) => ({
  email: preferences.email || 0,
  allowNextWeek: preferences.allowNextWeek || false,
  persistMeals: preferences.persistMeals || false,
  skipNotSignedUp: preferences.skipNotSignedUp || false,
});

const notificationSnapshot = (notifications = {}) => ({
  notificationTypes: notifications.notificationTypes || null,
  schedule: notifications.schedule || null,
  schema: notifications.schema || null,
  report: notifications.report || null,
  device: notifications.device || null,
});

const targetUserId = (request, reply) => {
  const forUser = getHeader(request, "user_id");
  if (forUser && forUser !== "undefined") {
    if (request.user.role !== "admin") {
      reply.code(401).send({ message: "Unauthorized" });
      return null;
    }
    return forUser;
  }
  return request.user.id;
};

export default async function preferencesRoutes(app) {
  app.get("/api/preferences", async (request, reply) => {
    await connectDB();
    const id = targetUserId(request, reply);
    if (!id) return undefined;
    return User.findById(id, "preferences firstName");
  });

  app.post("/api/preferences", async (request, reply) => {
    await connectDB();
    const id = targetUserId(request, reply);
    if (!id) return undefined;

    const isAdmin = request.user.role === "admin";
    const pref = request.body || {};
    const user = await User.findById(id, "preferences");
    if (!user.preferences) user.preferences = {};

    const before = preferenceSnapshot(user.preferences);
    user.preferences.email = pref.email;
    user.preferences.allowNextWeek = pref.allowNextWeek;
    if (isAdmin) {
      user.preferences.persistMeals = pref.persistMeals;
      user.preferences.skipNotSignedUp = pref.skipNotSignedUp;
    }
    user.markModified("preferences");
    await user.save();

    const diff = buildAuditRowDiff(before, preferenceSnapshot(user.preferences), preferenceFields);
    if (diff.changedFields.length > 0) {
      const context = auditContext(request);
      await logUserSettingsChange({
        ...context,
        targetUserId: id,
        changeType: "GENERAL_PREFERENCES_UPDATE",
        changedFields: diff.changedFields,
        oldValues: diff.oldValues,
        newValues: diff.newValues,
        metadata: { isAdmin, requestPath: context.requestPath },
      });
    }

    return { message: "OK" };
  });

  app.get("/api/preferences/notifications", async (request, reply) => {
    await connectDB();
    const id = targetUserId(request, reply);
    if (!id) return undefined;
    return User.findById(id, "notifications firstName");
  });

  app.post("/api/preferences/notifications", async (request, reply) => {
    await connectDB();
    const id = targetUserId(request, reply);
    if (!id) return undefined;

    const pref = request.body || {};
    const user = await User.findById(id, "notifications");
    if (!user.notifications) user.notifications = {};

    const before = notificationSnapshot(user.notifications);
    user.notifications.notificationTypes = pref.notificationTypes;
    user.notifications.schedule = pref.schedule;
    user.notifications.schema = pref.schema;
    user.notifications.report = pref.report;
    user.notifications.device = pref.device;
    user.markModified("notifications");
    await user.save();

    const diff = buildAuditRowDiff(before, notificationSnapshot(user.notifications), notificationFields);
    if (diff.changedFields.length > 0) {
      const context = auditContext(request);
      await logUserSettingsChange({
        ...context,
        targetUserId: id,
        changeType: "NOTIFICATION_PREFERENCES_UPDATE",
        changedFields: diff.changedFields,
        oldValues: diff.oldValues,
        newValues: diff.newValues,
        metadata: { requestPath: context.requestPath },
      });
    }

    return { message: "OK" };
  });

  app.post("/api/preferences/notifications/addDevice", async (request) => {
    await connectDB();
    const user = await User.findById(request.user.id, "notifications");
    const before = {
      notificationTypes: user.notifications?.notificationTypes || null,
      device: user.notifications?.device || null,
    };

    if (!user.notifications) user.notifications = {};
    user.notifications.device = request.body?.device;
    user.markModified("notifications");
    await user.save();

    const diff = buildAuditRowDiff(before, {
      notificationTypes: user.notifications.notificationTypes || null,
      device: user.notifications.device || null,
    }, deviceFields);

    if (diff.changedFields.length > 0) {
      const context = auditContext(request);
      await logUserSettingsChange({
        ...context,
        targetUserId: request.user.id,
        changeType: "NOTIFICATION_DEVICE_UPDATE",
        changedFields: diff.changedFields,
        oldValues: diff.oldValues,
        newValues: diff.newValues,
        metadata: { requestPath: context.requestPath },
      });
    }

    return { message: "OK" };
  });
}
