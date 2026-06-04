import connectDB from "@/_helpers/db/connect";
import User from "@/_helpers/db/models/User";
import { NextResponse } from "next/server";

import { defaultNotificationPreferences } from "../../../preferences/notifications/defaults";
import { buildAuditRowDiff, logUserSettingsChange } from "@/_helpers/userSettingsAudit";

const cloneDefaults = () => JSON.parse(JSON.stringify(defaultNotificationPreferences));

const NOTIFICATION_FIELDS = ["notificationTypes", "schedule", "schema", "report", "device"];

const getNotificationSnapshot = (notifications = {}) => ({
  notificationTypes: notifications.notificationTypes || null,
  schedule: notifications.schedule || null,
  schema: notifications.schema || null,
  report: notifications.report || null,
  device: notifications.device || null,
});

export async function POST(req) {
  await connectDB();

  if (req.headers.get("userRole") !== "admin") {
    return new NextResponse(
      JSON.stringify({ message: "Unauthorized" }),
      {
        status: 401,
        headers: { "content-type": "application/json" },
      }
    );
  }

  const { userIds, notificationPreferences, sectionsToModify } = await req.json();

  if (
    !Array.isArray(userIds) ||
    userIds.length === 0 ||
    !notificationPreferences ||
    !sectionsToModify ||
    !Object.values(sectionsToModify).some(Boolean)
  ) {
    return new NextResponse(
      JSON.stringify({ message: "Invalid request" }),
      {
        status: 400,
        headers: { "content-type": "application/json" },
      }
    );
  }

  const users = await User.find({ _id: { $in: userIds } }, "_id firstName lastName email notifications");
  const actorUserId = req.headers.get("userID");
  const actorRole = req.headers.get("userRole");

  await Promise.all(
    users.map(async (user) => {
      const defaults = cloneDefaults();
      const existingNotifications =
        typeof user.notifications?.toObject === "function"
          ? user.notifications.toObject()
          : user.notifications || {};

      const beforeSnapshot = getNotificationSnapshot(existingNotifications);

      user.notifications = {
        ...defaults,
        ...existingNotifications,
        device: existingNotifications.device ?? defaults.device,
      };

      if (sectionsToModify.notificationTypes) {
        user.notifications.notificationTypes = notificationPreferences.notificationTypes;
      }

      if (sectionsToModify.schema) {
        user.notifications.schema = notificationPreferences.schema;
      }

      if (sectionsToModify.report) {
        user.notifications.report = notificationPreferences.report;
      }

      if (sectionsToModify.schedule) {
        user.notifications.schedule = notificationPreferences.schedule;
      }

      user.markModified("notifications");
      await user.save();

      const afterSnapshot = getNotificationSnapshot(user.notifications);
      const diff = buildAuditRowDiff(beforeSnapshot, afterSnapshot, NOTIFICATION_FIELDS);

      if (diff.changedFields.length > 0) {
        return logUserSettingsChange({
          actorUserId,
          actorRole,
          targetUserId: user._id.toString(),
          changeType: "NOTIFICATION_PREFERENCES_BATCH_UPDATE",
          changedFields: diff.changedFields,
          oldValues: diff.oldValues,
          newValues: diff.newValues,
          metadata: {
            sectionsToModify,
            requestPath: req.nextUrl.pathname,
          },
          isBatch: true,
          requestPath: req.nextUrl.pathname,
          userAgent: req.headers.get("user-agent"),
        });
      }

      return undefined;
    })
  );

  return Response.json({
    updatedCount: users.length,
    skippedCount: Math.max(userIds.length - users.length, 0),
    updatedUsers: users.map((user) => ({
      id: user._id.toString(),
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    })),
  });
}

export const dynamic = "force-dynamic";
