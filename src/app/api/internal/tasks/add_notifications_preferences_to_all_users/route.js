import connectDB from "@/_helpers/db/connect";
import User from "@/_helpers/db/models/User";

import { defaultNotificationPreferences } from '../../../preferences/notifications/defaults'


export async function GET(req, res) {
  await connectDB();

  const users = await User.find({}, "_id firstName notifications");
    
  await Promise.all(users.map(async (user) => {
    console.log("Checking user:", user.firstName, user.notifications);
    user.notifications = defaultNotificationPreferences;

      user.markModified("notifications");
    
      await user.save();
  }));


    console.log("Added default notifications preferences to all users");
  return Response.json({ message: "Added default notifications preferences to all users" });
}