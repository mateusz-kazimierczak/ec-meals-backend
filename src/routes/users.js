import bcrypt from "bcryptjs";
import connectDB from "../_helpers/db/connect.js";
import User from "../_helpers/db/models/User.js";
import initUser from "../_helpers/db/initUser.js";
import { sendWelcomeEmail } from "../_helpers/emails.jsx";
import { buildAuditRowDiff, logUserSettingsChange } from "../_helpers/userSettingsAudit.js";
import { defaultNotificationPreferences } from "../domain/notificationDefaults.js";
import { auditContext } from "../lib/audit.js";
import { getHeader } from "../lib/http.js";

const cloneDefaults = () => JSON.parse(JSON.stringify(defaultNotificationPreferences));

const notificationFields = ["notificationTypes", "schedule", "schema", "report", "device"];
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
  notificationTypes: notifications.notificationTypes || null,
  schedule: notifications.schedule || null,
  schema: notifications.schema || null,
  report: notifications.report || null,
  device: notifications.device || null,
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

const buildUser = async (input) => {
  const data = { ...input };
  if (data.birthday) {
    const [day, month] = data.birthday.split("/").map((value) => parseInt(value, 10));
    data.birthday = { day, month };
  }

  const user = {
    username: data.username?.toLowerCase().trim(),
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    room: data.room,
    role: data.role,
    active: data.active,
    guest: data.guest,
    birthdayDay: data.birthday?.day || null,
    birthdayMonth: data.birthday?.month || null,
    diet: data.diet || null,
    notifications: cloneDefaults(),
  };

  if (data.password) user.hash = await bcrypt.hash(data.password, 10);
  return user;
};

const buildUserUpdate = async (input) => {
  const data = { ...input };
  const update = {};

  if (data.birthday) {
    const [day, month] = data.birthday.split("/").map((value) => parseInt(value, 10));
    update.birthdayDay = day || null;
    update.birthdayMonth = month || null;
  }

  [
    "firstName",
    "lastName",
    "email",
    "room",
    "role",
    "active",
    "guest",
    "diet",
  ].forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(data, field)) update[field] = data[field];
  });

  if (Object.prototype.hasOwnProperty.call(data, "username")) {
    update.username = data.username?.toLowerCase().trim();
  }

  if (data.password) update.hash = await bcrypt.hash(data.password, 10);
  return update;
};

const requestedUserId = (request) => {
  const userId = getHeader(request, "user_id");
  return !userId || userId === "undefined" ? request.user.id : userId;
};

export default async function usersRoutes(app) {
  app.get("/api/users/all", async () => {
    await connectDB();
    return User.find({});
  });

  app.get("/api/users/single", async (request, reply) => {
    await connectDB();
    const userId = requestedUserId(request);
    if (request.user.role !== "admin" && userId !== request.user.id) return reply.code(402).send();
    return User.findById(userId);
  });

  app.patch("/api/users/single", async (request) => {
    await connectDB();
    const userId = requestedUserId(request);
    const beforeUser = await User.findById(userId, "firstName lastName username email role room active guest diet birthdayDay birthdayMonth").lean();
    const before = userAuditSnapshot(beforeUser);
    const userUpdate = await buildUserUpdate(request.body || {});
    const passwordChanged = Boolean(userUpdate.hash);

    await User.findOneAndUpdate({ _id: userId }, { $set: userUpdate });

    const afterUser = await User.findById(userId, "firstName lastName username email role room active guest diet birthdayDay birthdayMonth").lean();
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
    await connectDB();
    if (request.user.role !== "admin") return reply.code(402).send();
    await User.findOneAndDelete({ _id: getHeader(request, "user_id") });
    return { success: true };
  });

  app.post("/api/users/single", async (request, reply) => {
    await connectDB();
    const data = request.body || {};
    const user = await buildUser(data);
    initUser(user);

    try {
      await User.create(user);
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
    await connectDB();
    if (request.user.role !== "admin") return reply.code(401).send({ message: "Unauthorized" });

    const { userIds, notificationPreferences, sectionsToModify } = request.body || {};
    if (!Array.isArray(userIds) || userIds.length === 0 || !notificationPreferences || !sectionsToModify || !Object.values(sectionsToModify).some(Boolean)) {
      return reply.code(400).send({ message: "Invalid request" });
    }

    const users = await User.find({ _id: { $in: userIds } }, "_id firstName lastName email notifications");
    const context = auditContext(request);

    await Promise.all(users.map(async (user) => {
      const existing = typeof user.notifications?.toObject === "function"
        ? user.notifications.toObject()
        : user.notifications || {};
      const before = notificationSnapshot(existing);

      user.notifications = { ...cloneDefaults(), ...existing, device: existing.device ?? cloneDefaults().device };
      if (sectionsToModify.notificationTypes) user.notifications.notificationTypes = notificationPreferences.notificationTypes;
      if (sectionsToModify.schema) user.notifications.schema = notificationPreferences.schema;
      if (sectionsToModify.report) user.notifications.report = notificationPreferences.report;
      if (sectionsToModify.schedule) user.notifications.schedule = notificationPreferences.schedule;

      user.markModified("notifications");
      await user.save();

      const diff = buildAuditRowDiff(before, notificationSnapshot(user.notifications), notificationFields);
      if (diff.changedFields.length > 0) {
        await logUserSettingsChange({
          ...context,
          targetUserId: user._id.toString(),
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
