import { buildAuditRowDiff, logUserSettingsChange } from "../_helpers/userSettingsAudit.js";
import { auditContext } from "../lib/audit.js";
import { getHeader } from "../lib/http.js";
import {
  getNotifications,
  getPreferences,
  updateNotificationDevice,
  updateNotifications,
  updatePreferences,
} from "../data/preferences.js";

const preferenceFields = ["allowNextWeek", "persistMeals", "skipNotSignedUp"];
const notificationFields = ["emailEnabled", "pushEnabled", "rules", "windows"];
const deviceFields = ["device"];

const preferenceSnapshot = (preferences = {}) => ({
  allowNextWeek: preferences.allowNextWeek || false,
  persistMeals: preferences.persistMeals || false,
  skipNotSignedUp: preferences.skipNotSignedUp || false,
});

const notificationSnapshot = (notifications = {}) => ({
  emailEnabled: notifications.emailEnabled || false,
  pushEnabled: notifications.pushEnabled || false,
  rules: notifications.rules || null,
  windows: notifications.windows || null,
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
    const id = targetUserId(request, reply);
    if (!id) return undefined;
    return getPreferences(id);
  });

  app.post("/api/preferences", async (request, reply) => {
    const id = targetUserId(request, reply);
    if (!id) return undefined;

    const isAdmin = request.user.role === "admin";
    const pref = request.body || {};
    const current = await getPreferences(id);
    const before = preferenceSnapshot(current?.preferences);
    const user = await updatePreferences(id, pref, { isAdmin });

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
    const id = targetUserId(request, reply);
    if (!id) return undefined;
    return getNotifications(id);
  });

  app.post("/api/preferences/notifications", async (request, reply) => {
    const id = targetUserId(request, reply);
    if (!id) return undefined;

    const pref = request.body || {};
    const current = await getNotifications(id);
    const before = notificationSnapshot(current?.notifications);
    const user = await updateNotifications(id, pref);

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
    const current = await getNotifications(request.user.id);
    const before = {
      device: current?.notifications?.device || null,
    };

    const user = await updateNotificationDevice(request.user.id, request.body?.device);

    const diff = buildAuditRowDiff(before, {
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
