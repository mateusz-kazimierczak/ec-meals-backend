import connectDB from "@/_helpers/db/connect";
import User from "@/_helpers/db/models/User";
import { buildAuditRowDiff, logUserSettingsChange } from "@/_helpers/userSettingsAudit";

const NOTIFICATION_FIELDS = ["notificationTypes", "schedule", "schema", "report", "device"];

const getNotificationSnapshot = (notifications = {}) => {
  return {
    notificationTypes: notifications.notificationTypes || null,
    schedule: notifications.schedule || null,
    schema: notifications.schema || null,
    report: notifications.report || null,
    device: notifications.device || null,
  };
};

export async function GET(req, res) {
  await connectDB();
  const forUser_ID = req.headers.get("user_id");

  let ID;
  if (forUser_ID != "undefined") {

    if (req.headers.get("userRole") !== "admin") {
      return Response.json({
        message: "Unauthorized",
      });
    }
    ID = forUser_ID;
  } else {
    ID =req.headers.get("userID");
  }

  const data = await User.findById(ID, "notifications firstName");

  return Response.json(data);
}

export async function POST(req, res) {
  await connectDB();
  const forUser_ID = req.headers.get("user_id");

  let ID;
  const isAdmin = req.headers.get("userRole") === "admin";

  if (forUser_ID != "undefined") {
    if (req.headers.get("userRole") !== "admin") {
      return Response.json({
        message: "Unauthorized",
      });
    }
    ID = forUser_ID;
  } else {
    ID = req.headers.get("userID");
  }


  const pref = await req.json();
  const actorUserId = req.headers.get("userID");
  const actorRole = req.headers.get("userRole");

  const oldPref = await User.findById(ID, "notifications");

  if (!oldPref.notifications) {
    oldPref.notifications = {};
  }

  const beforeSnapshot = getNotificationSnapshot(oldPref.notifications);

  // If the notifications object does not exist, create it
  if (!oldPref.notifications) {
    oldPref.notifications = {};
  }

  
  oldPref.notifications.notificationTypes = pref.notificationTypes;
  oldPref.notifications.schedule = pref.schedule;
  oldPref.notifications.schema = pref.schema;
  oldPref.notifications.report = pref.report;
  oldPref.notifications.device = pref.device;

  oldPref.markModified("notifications");

  await oldPref.save();

  const afterSnapshot = getNotificationSnapshot(oldPref.notifications);
  const diff = buildAuditRowDiff(beforeSnapshot, afterSnapshot, NOTIFICATION_FIELDS);

  if (diff.changedFields.length > 0) {
    await logUserSettingsChange({
      actorUserId,
      actorRole,
      targetUserId: ID,
      changeType: "NOTIFICATION_PREFERENCES_UPDATE",
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
