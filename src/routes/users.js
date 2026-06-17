import { sendWelcomeEmail } from "../_helpers/emails.jsx";
import { buildAuditRowDiff, logUserSettingsChange } from "../_helpers/userSettingsAudit.js";
import { defaultNotificationPreferences } from "../domain/notificationDefaults.js";
import { auditContext } from "../lib/audit.js";
import { getHeader } from "../lib/http.js";
import {
  createUser,
  deleteUser,
  findUserById,
  listUsers,
  updateUser,
} from "../data/users.js";
import { updateNotifications } from "../data/preferences.js";

const cloneDefaults = () => JSON.parse(JSON.stringify(defaultNotificationPreferences));

const notificationFields = ["emailEnabled", "pushEnabled", "rules", "windows"];
const userAuditFields = [
  "firstName",
  "lastName",
  "username",
  "email",
  "role",
  "room",
  "active",
  "guest",
  "diet",
  "birthdayDay",
  "birthdayMonth",
];

const notificationSnapshot = (notifications = {}) => ({
  emailEnabled: notifications.emailEnabled || false,
  pushEnabled: notifications.pushEnabled || false,
  rules: notifications.rules || null,
  windows: notifications.windows || null,
});

const userAuditSnapshot = (user) => ({
  firstName: user?.firstName || null,
  lastName: user?.lastName || null,
  username: user?.username || null,
  email: user?.email || null,
  role: user?.role || null,
  room: user?.room || null,
  active: !!user?.active,
  guest: !!user?.guest,
  diet: user?.diet || null,
  birthdayDay: user?.birthdayDay ?? null,
  birthdayMonth: user?.birthdayMonth ?? null,
});

const requestedUserId = (request) => {
  const userId = getHeader(request, "user_id");
  return !userId || userId === "undefined" ? request.user.id : userId;
};

export default async function usersRoutes(app) {
  app.get("/api/users/all", async () => {
    return listUsers();
  });

  app.get("/api/users/single", async (request, reply) => {
    const userId = requestedUserId(request);
    if (request.user.role !== "admin" && userId !== request.user.id) return reply.code(402).send();
    return findUserById(userId);
  });

  app.patch("/api/users/single", async (request) => {
    const userId = requestedUserId(request);
    const beforeUser = await findUserById(userId);
    const before = userAuditSnapshot(beforeUser);
    const passwordChanged = Boolean(request.body?.password);

    const afterUser = await updateUser(userId, request.body || {});
    const diff = buildAuditRowDiff(before, userAuditSnapshot(afterUser), userAuditFields);

    if (diff.changedFields.length > 0 || passwordChanged) {
      if (passwordChanged && !diff.changedFields.includes("password")) diff.changedFields.push("password");
      const context = auditContext(request);
      await logUserSettingsChange({
        ...context,
        targetUserId: userId,
        changeType: "USER_PROFILE_UPDATE",
        changedFields: diff.changedFields,
        oldValues: diff.oldValues,
        newValues: diff.newValues,
        metadata: { passwordChanged, requestPath: context.requestPath },
      });
    }

    return { success: true };
  });

  app.delete("/api/users/single", async (request, reply) => {
    if (request.user.role !== "admin") return reply.code(402).send();
    await deleteUser(getHeader(request, "user_id"));
    return { success: true };
  });

  app.post("/api/users/single", async (request, reply) => {
    const data = request.body || {};

    try {
      await createUser(data);
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ success: false });
    }

    if (data.email && data.sendWelcomeEmail) {
      await sendWelcomeEmail(
        { email: data.email, firstName: data.firstName, username: data.username },
        data.password,
      );
    }

    return { success: true, new: "yes" };
  });

  app.post("/api/users/batch/notifications", async (request, reply) => {
    if (request.user.role !== "admin") return reply.code(401).send({ message: "Unauthorized" });

    const { userIds, notificationPreferences, sectionsToModify } = request.body || {};
    if (!Array.isArray(userIds) || userIds.length === 0 || !notificationPreferences || !sectionsToModify || !Object.values(sectionsToModify).some(Boolean)) {
      return reply.code(400).send({ message: "Invalid request" });
    }

    const users = (await Promise.all(userIds.map((id) => findUserById(id)))).filter(Boolean);
    const context = auditContext(request);

    await Promise.all(users.map(async (user) => {
      const existing = user.notifications || {};
      const before = notificationSnapshot(existing);

      const next = { ...cloneDefaults(), ...existing, device: existing.device ?? cloneDefaults().device };
      if (sectionsToModify.channels) {
        next.emailEnabled = notificationPreferences.emailEnabled;
        next.pushEnabled = notificationPreferences.pushEnabled;
      }
      if (sectionsToModify.rules) next.rules = notificationPreferences.rules;
      if (sectionsToModify.windows) next.windows = notificationPreferences.windows;
      await updateNotifications(user.id, next);

      const diff = buildAuditRowDiff(before, notificationSnapshot(next), notificationFields);
      if (diff.changedFields.length > 0) {
        await logUserSettingsChange({
          ...context,
          targetUserId: user.id,
          changeType: "NOTIFICATION_PREFERENCES_BATCH_UPDATE",
          changedFields: diff.changedFields,
          oldValues: diff.oldValues,
          newValues: diff.newValues,
          metadata: { sectionsToModify, requestPath: context.requestPath },
          isBatch: true,
        });
      }
    }));

    return {
      updatedCount: users.length,
      skippedCount: Math.max(userIds.length - users.length, 0),
      updatedUsers: users.map((user) => ({
        id: user._id.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      })),
    };
  });
}
