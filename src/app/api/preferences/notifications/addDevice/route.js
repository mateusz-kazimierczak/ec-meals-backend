import connectDB from "@/_helpers/db/connect";
import User from "@/_helpers/db/models/User";
import { buildAuditRowDiff, logUserSettingsChange } from "@/_helpers/userSettingsAudit";

const NOTIFICATION_FIELDS = ["notificationTypes", "device"];

const getNotificationSnapshot = (notifications = {}) => ({
  notificationTypes: notifications.notificationTypes || null,
  device: notifications.device || null,
});

export async function POST(req, res) {
  await connectDB();
  const ID = req.headers.get("userID");

  const oldPref = await User.findById(ID, "notifications");
  const actorUserId = req.headers.get("userID");
  const actorRole = req.headers.get("userRole");
  const beforeSnapshot = getNotificationSnapshot(oldPref.notifications || {});

  const { device } = await req.json();

  // If the notifications object does not exist, create it
  if (!oldPref.notifications) {
    oldPref.notifications = {};
  }

  oldPref.notifications.device = device;
  oldPref.markModified("notifications");

  await oldPref.save();

  const afterSnapshot = getNotificationSnapshot(oldPref.notifications);
  const diff = buildAuditRowDiff(beforeSnapshot, afterSnapshot, NOTIFICATION_FIELDS);

  if (diff.changedFields.length > 0) {
    await logUserSettingsChange({
      actorUserId,
      actorRole,
      targetUserId: ID,
      changeType: "NOTIFICATION_DEVICE_UPDATE",
      changedFields: diff.changedFields,
      oldValues: diff.oldValues,
      newValues: diff.newValues,
      metadata: {
        requestPath: req.nextUrl.pathname,
      },
      requestPath: req.nextUrl.pathname,
      userAgent: req.headers.get("user-agent"),
    });
  }

  return Response.json({
    message: "OK",
  });
}

// forces the route handler to be dynamic
export const dynamic = "force-dynamic";
