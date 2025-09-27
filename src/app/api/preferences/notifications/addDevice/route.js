import connectDB from "@/_helpers/db/connect";
import User from "@/_helpers/db/models/User";

export async function POST(req, res) {
  await connectDB();
  const ID = req.headers.get("userID");

  const oldPref = await User.findById(ID, "notifications");

  const { device } = await req.json();

  // If the notifications object does not exist, create it
  if (!oldPref.notifications) {
    oldPref.notifications = {};
  }

  oldPref.notifications.device = device;
  oldPref.notifications.notificationTypes.push = true;
  oldPref.markModified("notifications");

  await oldPref.save();

  return Response.json({
    message: "OK",
  });
}

// forces the route handler to be dynamic
export const dynamic = "force-dynamic";
