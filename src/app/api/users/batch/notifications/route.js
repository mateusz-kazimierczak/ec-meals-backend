import connectDB from "@/_helpers/db/connect";
import User from "@/_helpers/db/models/User";
import { NextResponse } from "next/server";

import { defaultNotificationPreferences } from "../../../preferences/notifications/defaults";

const cloneDefaults = () => JSON.parse(JSON.stringify(defaultNotificationPreferences));

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

  await Promise.all(
    users.map(async (user) => {
      const defaults = cloneDefaults();
      const existingNotifications =
        typeof user.notifications?.toObject === "function"
          ? user.notifications.toObject()
          : user.notifications || {};

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
